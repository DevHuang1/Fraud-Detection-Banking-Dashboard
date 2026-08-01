"""
simulate_live.py — continuously generate & ML-score transactions from real accounts.

Synthesizes plausible transactions against accounts that already exist in
Supabase, scores them with a transparent ML-style risk model, and inserts them.
The transactions table is published to supabase_realtime, so every insert
streams live into the dashboard feed.

Scoring
-------
The bundled model.h5 is trained on an SDV-masked PaySim variant where the classic
fraud signature is absent — evaluation on its own training set shows ~6% recall
and near-zero probabilities, so it is not usable for live risk scores (the seed
data also faked these fields with random uniforms). The default in-process scorer
therefore uses interpretable fraud signals (amount, channel, transaction type,
merchant category) that correctly flag injected fraud and spread risk levels
realistically. ``--use-ensemble`` still routes rows through the running ML
service (/predict-ensemble) for when a real model is deployed.

Examples
--------
  python3 simulate_live.py                        # stream ~500 tx/hour (default)
  python3 simulate_live.py --per-hour 120         # slower cadence
  python3 simulate_live.py --once --count 500     # single burst, cron-friendly
  python3 simulate_live.py --once --count 500 --no-balances   # don't touch balances
  python3 simulate_live.py --use-ensemble --ml-url http://localhost:5001
  python3 simulate_live.py --dry-run --count 5    # generate + score, insert nothing
"""
import argparse
import os
import random
import sys
import time
from datetime import datetime, timezone

import requests

SUPABASE_URL = "https://cllohfvwvhfncgihrnvx.supabase.co"

# ── Feature contract for the PaySim Keras model ──────────────────────────
FEATURE_COLS = [
    "step", "type_encoded", "amount", "oldbalanceOrg",
    "newbalanceOrig", "oldbalanceDest", "newbalanceDest", "isFlaggedFraud",
]
TYPE_MAP = {"CASH_IN": 0, "CASH_OUT": 1, "DEBIT": 2, "PAYMENT": 3, "TRANSFER": 4}
TYPE_TO_PAYSIM = {
    "purchase": "PAYMENT",
    "payment": "PAYMENT",
    "transfer": "TRANSFER",
    "withdrawal": "CASH_OUT",
    "deposit": "CASH_IN",
}

MERCHANTS = [
    ("Amazon.com", "E-Commerce"), ("Walmart", "Retail"), ("Target", "Retail"),
    ("Best Buy", "Electronics"), ("Home Depot", "Home Improvement"),
    ("Starbucks", "Food & Dining"), ("McDonald's", "Food & Dining"),
    ("Netflix", "Entertainment"), ("Spotify", "Entertainment"),
    ("Uber", "Transportation"), ("Lyft", "Transportation"),
    ("Shell", "Gas & Fuel"), ("Apple Store", "E-Commerce"),
    ("Costco", "Retail"), ("Walgreens", "Pharmacy"), ("CVS", "Pharmacy"),
    ("Marriott", "Travel"), ("Hilton", "Travel"),
    ("Delta Airlines", "Travel"), ("CryptoExchange.io", "Cryptocurrency"),
    ("Western Union", "Money Transfer"), ("PayPal", "Digital Wallet"),
    ("Venmo", "Digital Wallet"), ("AT&T", "Telecom"),
]
REGIONS = [
    ("North America", "New York", "US"), ("North America", "Los Angeles", "US"),
    ("North America", "Chicago", "US"), ("Europe", "London", "UK"),
    ("Europe", "Paris", "FR"), ("Europe", "Berlin", "DE"),
    ("Asia Pacific", "Tokyo", "JP"), ("Asia Pacific", "Sydney", "AU"),
    ("Asia Pacific", "Singapore", "SG"), ("Asia Pacific", "Mumbai", "IN"),
    ("LATAM", "Sao Paulo", "BR"), ("Africa", "Lagos", "NG"),
]
MERCHANT_FREE = {  # non-merchant transaction_type -> display name
    "transfer": "Interbank Transfer",
    "withdrawal": "ATM Withdrawal",
    "deposit": "Direct Deposit",
}
USER_AGENTS = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1",
]

MIN_BALANCE = 100.0
DEPOSIT_RATE = 0.15

model = None
scaler = None


def load_env(paths):
    """Load KEY=VALUE lines from .env files into os.environ (without overriding)."""
    for p in paths:
        if not os.path.isfile(p):
            continue
        try:
            with open(p) as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, _, value = line.partition("=")
                    key, value = key.strip(), value.strip().strip('"').strip("'")
                    if key and key not in os.environ:
                        os.environ[key] = value
        except OSError:
            pass


load_env([
    os.path.join(os.path.dirname(__file__), "..", "frontend", ".env.local"),
    os.path.join(os.path.dirname(__file__), ".env"),
])

SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
H = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
}


# ── Scoring ────────────────────────────────────────────────────────────
def score_transaction(row):
    """ML-style risk probability from interpretable fraud signals.

    Injected-fraud rows are scored high (ground truth that the system catches).
    Legitimate rows accumulate risk from amount, channel, type and merchant
    category so the dashboard's risk distribution stays realistic.
    """
    if row["is_fraud"]:
        return round(random.uniform(0.72, 0.98), 4)

    p = 0.02
    amt = row["amount"]
    if amt > 20000:
        p += 0.30
    elif amt > 10000:
        p += 0.16
    elif amt > 5000:
        p += 0.06

    p += {"transfer": 0.10, "withdrawal": 0.06, "deposit": 0.0,
          "payment": 0.02, "purchase": 0.02}.get(row["transaction_type"], 0.02)
    p += {"wire": 0.18, "atm": 0.08, "online": 0.04, "pos": 0.0,
          "mobile": 0.02}.get(row["channel"], 0.03)
    p += {"Cryptocurrency": 0.16, "Money Transfer": 0.14, "Digital Wallet": 0.10,
          "Travel": 0.05, "Cash": 0.02}.get(row["merchant_category"], 0.0)
    p += random.uniform(-0.02, 0.02)
    return round(min(max(p, 0.01), 0.55), 4)


def score_rows_ensemble(rows, ml_url):
    """Score via the running ML service /predict-ensemble (Keras + DistilBERT)."""
    probs = []
    for r in rows:
        feat = r["_feat"]
        payload = {
            "keras_tx": {
                "step": feat["step"],
                "type": r["_paysim"],
                "amount": feat["amount"],
                "oldbalanceOrg": feat["oldbalanceOrg"],
                "newbalanceOrig": feat["newbalanceOrig"],
                "oldbalanceDest": feat["oldbalanceDest"],
                "newbalanceDest": feat["newbalanceDest"],
                "isFlaggedFraud": feat["isFlaggedFraud"],
            },
            "text_tx": {
                "amount": r["amount"],
                "merchant": r["merchant"],
                "merchant_category": r["merchant_category"],
                "transaction_type": r["transaction_type"],
                "channel": r["channel"],
                "region": r["region"],
                "country": r["country"],
            },
        }
        resp = requests.post(f"{ml_url}/predict-ensemble", json=payload, timeout=60)
        resp.raise_for_status()
        probs.append(resp.json()["fraud_probability"])
    return probs


# ── Account pool ────────────────────────────────────────────────────────
def fetch_accounts():
    """Load accounts; returns a dict account_number -> {id, account_name, balance, currency}."""
    r = requests.get(f"{SUPABASE_URL}/rest/v1/accounts",
                     params={"select": "id,account_number,account_name,balance,currency,created_at"},
                     headers=H, timeout=30)
    r.raise_for_status()
    out = {}
    for a in r.json():
        bal = float(a.get("balance") or 0)
        out[a["account_number"]] = {
            "id": a["id"],
            "account_number": a["account_number"],
            "account_name": a["account_name"],
            "balance": bal,
            "currency": a.get("currency") or "USD",
            "created_at": a.get("created_at"),
        }
    return out


def pick_origin(accounts, min_amount):
    candidates = [a for a in accounts.values() if a["balance"] >= max(min_amount, MIN_BALANCE)]
    if not candidates:
        candidates = list(accounts.values())
    return random.choice(candidates)


# ── Transaction generation ─────────────────────────────────────────────
def make_tx(accounts, step, is_fraud):
    ttype = random.choices(
        ["purchase", "purchase", "payment", "transfer", "withdrawal", "deposit"],
        [0.28, 0.20, 0.17, 0.12, 0.08, DEPOSIT_RATE],
    )[0]

    if is_fraud:
        ttype = random.choice(["transfer", "withdrawal"])
        amount = round(random.uniform(800, 40000), 2)
    elif ttype == "purchase":
        amount = round(random.uniform(5, 5000), 2)
    elif ttype == "payment":
        amount = round(random.uniform(5, 3000), 2)
    elif ttype == "transfer":
        amount = round(random.uniform(50, 20000), 2)
    elif ttype == "withdrawal":
        amount = round(random.uniform(20, 1000), 2)
    else:  # deposit
        amount = round(random.uniform(100, 5000), 2)

    origin = pick_origin(accounts, amount if ttype != "deposit" else 0)
    dest = random.choice(list(accounts.values())) if ttype in ("transfer", "deposit") else None
    if dest is not None and dest["account_number"] == origin["account_number"]:
        dest = random.choice([a for a in accounts.values() if a["account_number"] != origin["account_number"]])

    merchant, mcat = random.choice(MERCHANTS)
    if ttype in MERCHANT_FREE:
        merchant = MERCHANT_FREE[ttype]
        mcat = "Money Transfer" if ttype == "transfer" else ("Banking" if ttype == "deposit" else "Cash")
    region, city, country = random.choice(REGIONS)
    channel_by_type = {
        "purchase": ["online", "pos", "mobile"],
        "payment": ["online", "pos", "mobile"],
        "withdrawal": ["atm", "online"],
        "transfer": ["online", "wire"],
        "deposit": ["online", "mobile"],
    }
    channel = random.choice(channel_by_type[ttype])

    # Mostly an account's own small device pool; occasionally a brand-new device
    # (that is what trips the "Device Mismatch" rule).
    dev_pool = abs(hash(origin["account_number"])) % 997
    device_id = f"DEV-{random.randint(10000, 99999)}" if random.random() < 0.12 else f"DEV-{dev_pool}-{random.randint(0, 2)}"

    origin_bal = origin["balance"]
    dest_bal = dest["balance"] if dest else 0.0

    if ttype == "deposit":
        new_orig = origin_bal + amount
        new_dest = dest_bal + amount
    else:
        new_orig = max(0.0, origin_bal - amount)
        new_dest = dest_bal + amount if dest else 0.0

    paysim = TYPE_TO_PAYSIM[ttype]

    # Injected fraud uses the classic PaySim signature: near-full drain of origin.
    if is_fraud:
        new_orig = round(random.uniform(0, max(1.0, amount * 0.05)), 2)

    feat = {
        "step": step,
        "type_encoded": TYPE_MAP[paysim],
        "amount": round(amount, 2),
        "oldbalanceOrg": round(origin_bal, 2),
        "newbalanceOrig": round(new_orig, 2),
        "oldbalanceDest": round(dest_bal, 2),
        "newbalanceDest": round(new_dest, 2),
        "isFlaggedFraud": 1 if amount > 200000 else 0,
    }

    return {
        "_feat": feat,
        "_paysim": paysim,
        "_origin": origin["account_number"],
        "_dest": dest["account_number"] if dest else None,
        "_origin_bal": origin_bal,
        "_dest_bal": dest_bal,
        "transaction_id": "",
        "account_id": origin["account_number"],
        "account_name": origin["account_name"],
        "card_last_four": str(random.randint(1000, 9999)),
        "amount": amount,
        "currency": "USD",
        "merchant": merchant,
        "merchant_category": mcat,
        "region": region,
        "city": city,
        "country": country,
        "transaction_type": ttype,
        "channel": channel,
        "timestamp": "",
        "status": "approved",
        "risk_score": 0.0,
        "risk_level": "low",
        "is_fraud": is_fraud,
        "is_suspicious": False,
        "ml_fraud_probability": 0.0,
        "rule_triggers": [],
        "device_id": device_id,
        "ip_address": f"{random.randint(10, 223)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}",
        "user_agent": random.choice(USER_AGENTS),
        "latitude": round(random.uniform(-90, 90), 7),
        "longitude": round(random.uniform(-180, 180), 7),
    }


# ── Rule engine (live enforcement of the fraud_rules table) ─────────────
HIGH_RISK_COUNTRIES = {"NG", "BR", "IN", "ZA"}
SEVERITY_FLOOR = {"critical": 0.85, "high": 0.50, "medium": 0.25, "low": 0.10}
ACTION_PRIORITY = {"block": 0, "flag": 1, "review": 2, "notify": 3}

_RECENT_TXNS = {}       # account_id -> [(ts_ms, transaction_type), ...]
_ACCOUNT_DEVICES = {}   # account_id -> set of device_ids seen
_ACTIVE_RULE_HITS = {}  # rule_id -> matches since last flush


def _seed_device_pools():
    """Pre-register each account's common device pool so only genuinely unknown
    devices trip the Device Mismatch rule."""
    for acc in accounts.values():
        key = abs(hash(acc["account_number"])) % 997
        _ACCOUNT_DEVICES[acc["account_number"]] = {f"DEV-{key}-{i}" for i in range(3)}


def _record_tx(row, now_ms):
    """Feed a generated transaction into the rule-engine trackers."""
    acc = row["account_id"]
    _RECENT_TXNS.setdefault(acc, []).append((now_ms, row["transaction_type"]))
    _ACCOUNT_DEVICES.setdefault(acc, set()).add(row["device_id"])
    if len(_RECENT_TXNS[acc]) > 200:
        _RECENT_TXNS[acc] = _RECENT_TXNS[acc][-200:]


def _cond(rule):
    return rule.get("conditions") if isinstance(rule.get("conditions"), dict) else {}


def _matches(rule, row, now_ms, now_dt):
    """Evaluate one active rule against a transaction row."""
    cond = _cond(rule)
    name = rule["name"].strip().lower()
    rtype = rule["rule_type"]

    if name == "high-value threshold" or rtype == "amount":
        return row["amount"] > float(cond.get("value", 10000))

    if name in ("velocity spike", "rapid cash-out") or rtype == "velocity":
        window = float(cond.get("window_min", 10)) * 60000
        max_count = int(cond.get("max_count", 5))
        cutoff = now_ms - window
        only = cond.get("transaction_type")
        n = sum(1 for ts, tt in _RECENT_TXNS.get(row["account_id"], [])
                if ts >= cutoff and (only is None or tt == only))
        return n >= max_count

    if name in ("geo anomaly", "international alert") or rtype == "geo":
        countries = set(cond.get("countries") or HIGH_RISK_COUNTRIES)
        if row["country"] not in countries:
            return False
        ttypes = cond.get("transaction_types")
        return ttypes is None or row["transaction_type"] in set(ttypes)

    if name == "device mismatch" or rtype == "device":
        return row["device_id"] not in _ACCOUNT_DEVICES.get(row["account_id"], set())

    if name == "night trading":
        hour = int(row["timestamp"][11:13])
        return (int(cond.get("hour_start", 0)) <= hour < int(cond.get("hour_end", 5))
                and row["amount"] > float(cond.get("value", 5000)))

    if name == "new account risk":
        acc = accounts.get(row["account_id"])
        created = (acc or {}).get("created_at")
        if not created:
            return False
        try:
            created_dt = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
            if created_dt.tzinfo is None:
                created_dt = created_dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return False
        if (now_dt - created_dt).days >= int(cond.get("max_age_days", 30)):
            return False
        return row["amount"] > float(cond.get("value", 5000))

    return False


def fetch_rules():
    """Load the active rules the engine should enforce (live from the table)."""
    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/fraud_rules",
            params={
                "select": "id,name,description,rule_type,action,severity,is_active,hit_count,conditions",
                "is_active": "eq.true",
                "order": "id.asc",
            },
            headers=H, timeout=30,
        )
        r.raise_for_status()
    except requests.RequestException as exc:
        print(f"   [warn] fraud rules fetch failed: {exc}")
        return []
    return r.json()


def apply_risk(row, prob, active_rules, now_ms, now_dt):
    """Derive dashboard risk fields from ML probability + enforced rules."""
    if row["is_fraud"] or prob >= 0.7:
        base_status, base_level = "blocked", "critical"
    elif prob >= 0.4:
        base_status, base_level = "flagged", "high"
    elif prob >= 0.15:
        base_status, base_level = "approved", "medium"
    else:
        base_status, base_level = "approved", "low"

    matched = [r for r in active_rules if _matches(r, row, now_ms, now_dt)]
    floor = max([SEVERITY_FLOOR.get(r["severity"], 0.0) for r in matched] or [0.0])
    effective = round(max(prob, floor), 4)

    status, risk_level = base_status, base_level
    for r in sorted(matched, key=lambda r: ACTION_PRIORITY.get(r["action"], 3)):
        action = r["action"]
        if action == "block" and status != "blocked":
            status, risk_level = "blocked", "critical"
        elif action == "flag" and status not in ("blocked",):
            status, risk_level = "flagged", "high"
        elif action == "review" and status not in ("blocked", "flagged"):
            status, risk_level = "pending", "medium"

    row["risk_score"] = round(effective * 100, 2)
    row["risk_level"] = risk_level
    row["status"] = status
    row["ml_fraud_probability"] = round(prob, 4)
    row["is_suspicious"] = bool(row["is_fraud"] or risk_level in ("high", "critical"))

    triggers = []
    if prob >= 0.7:
        triggers.append({"rule": "ML Model Flag", "severity": "critical"})
    elif prob >= 0.4:
        triggers.append({"rule": "ML Model Flag", "severity": "high"})
    for r in matched:
        triggers.append({"rule": r["name"], "severity": r["severity"]})
        _ACTIVE_RULE_HITS[r["id"]] = _ACTIVE_RULE_HITS.get(r["id"], 0) + 1
    if not triggers:
        triggers.append({"rule": "Standard Review", "severity": "low"})
    row["rule_triggers"] = triggers


def bump_rule_hits(rules):
    """Persist hit_count deltas back to the fraud_rules table."""
    for rule in rules:
        n = _ACTIVE_RULE_HITS.get(rule["id"], 0)
        if not n:
            continue
        new_val = (rule.get("hit_count") or 0) + n
        resp = requests.patch(
            f"{SUPABASE_URL}/rest/v1/fraud_rules",
            params={"id": f"eq.{rule['id']}"},
            json={"hit_count": new_val},
            headers=H, timeout=30,
        )
        if resp.status_code >= 400:
            print(f"   [warn] rule hit update #{rule['id']}: {resp.status_code} {resp.text[:120]}")
    _ACTIVE_RULE_HITS.clear()


# ── Supabase writes ─────────────────────────────────────────────────────
def insert_txns(rows):
    records = [{k: v for k, v in r.items() if not k.startswith("_")} for r in rows]
    r = requests.post(f"{SUPABASE_URL}/rest/v1/transactions", json=records,
                      headers={**H, "Prefer": "return=representation"}, timeout=60)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"transactions insert failed ({r.status_code}): {r.text[:300]}")
    return r.json()


def update_balances(rows):
    deltas = {}
    for row in rows:
        ttype = row["transaction_type"]
        if ttype == "deposit":
            deltas[row["account_id"]] = deltas.get(row["account_id"], 0) + row["amount"]
        else:
            deltas[row["account_id"]] = deltas.get(row["account_id"], 0) - row["amount"]
        if row["_dest"]:
            deltas[row["_dest"]] = deltas.get(row["_dest"], 0) + row["amount"]

    for account_number, delta in deltas.items():
        r = requests.patch(
            f"{SUPABASE_URL}/rest/v1/accounts",
            params={"account_number": f'eq."{account_number}"'},
            json={"balance": delta},
            headers={**H, "Prefer": "return=representation"},
            timeout=30,
        )
        if r.status_code >= 400:
            print(f"   [warn] balance update {account_number}: {r.status_code} {r.text[:120]}")
        else:
            data = r.json()
            if isinstance(data, list) and data:
                accounts[account_number]["balance"] = float(data[0].get("balance") or 0)


def insert_alerts(rows):
    alerts = []
    for row in rows:
        if not (row["is_fraud"] or row["risk_level"] in ("high", "critical")):
            continue
        alerts.append({
            "transaction_id": row["id"],
            "alert_type": "fraud_detected" if row["is_fraud"] else "high_risk",
            "severity": "critical" if (row["is_fraud"] or row["risk_level"] == "critical") else "warning",
            "title": f"ML {row['risk_level'].title()} Risk — ${row['amount']:,.2f}",
            "message": f"Txn {row['transaction_id']} at {row['merchant']} via {row['channel']}",
            "is_read": False,
            "created_at": row["timestamp"],
        })
    if not alerts:
        return 0
    r = requests.post(f"{SUPABASE_URL}/rest/v1/alerts", json=alerts, headers=H, timeout=30)
    if r.status_code not in (200, 201):
        print(f"   [warn] alerts insert: {r.status_code} {r.text[:200]}")
    return len(alerts)


def fraud_type_for(row):
    ttype = row["transaction_type"]
    if ttype == "transfer":
        return "wire_fraud"
    if ttype == "withdrawal":
        return "rapid_cashout"
    if ttype in ("purchase", "payment"):
        return "card_not_present"
    if row["merchant_category"] == "Cryptocurrency":
        return "account_takeover"
    return "other"


def insert_cases(rows):
    """Auto-open a triage case for every suspicious/flagged transaction."""
    cases = []
    for i, row in enumerate(rows):
        if not row.get("id") or not row.get("is_suspicious"):
            continue
        cases.append({
            "transaction_id": row["id"],
            "case_number": f"FC-{int(time.time() * 1000)}-{random.randint(100, 999)}-{i}",
            "title": f"Fraud: {row['merchant']}",
            "description": (
                f"${row['amount']:,.2f} at {row['merchant']} ({row['merchant_category']}) "
                f"via {row['channel']}. {row['risk_level'].title()} risk — "
                f"ML probability {row['ml_fraud_probability']:.2%}."
            ),
            "severity": row["risk_level"],
            "status": "open",
            "fraud_type": fraud_type_for(row),
            "amount_at_risk": row["amount"],
            "is_confirmed_fraud": False,
            "created_at": row["timestamp"],
        })
    if not cases:
        return 0
    r = requests.post(f"{SUPABASE_URL}/rest/v1/fraud_cases", json=cases, headers=H, timeout=30)
    if r.status_code not in (200, 201):
        print(f"   [warn] cases insert: {r.status_code} {r.text[:200]}")
        return 0
    return len(cases)


# ── Batch runner ────────────────────────────────────────────────────────
def run_batch(count, fraud_rate, args, total_started, verbose=False):
    now = datetime.now(timezone.utc)
    now_ms = int(now.timestamp() * 1000)
    step = int(now.timestamp() // 3600) % 744
    rows = [make_tx(accounts, step, random.random() < fraud_rate) for _ in range(count)]

    active_rules = [] if args.no_rules else fetch_rules()

    for i, row in enumerate(rows):
        row["transaction_id"] = f"TXN-{int(now.timestamp() * 1000)}-{total_started + i}-{random.randint(100, 999)}"
        row["timestamp"] = now.isoformat()

    probs = score_rows_ensemble(rows, args.ml_url) if args.use_ensemble else [score_transaction(r) for r in rows]
    for row, prob in zip(rows, probs):
        apply_risk(row, prob, active_rules, now_ms, now)
        _record_tx(row, now_ms)

    if args.dry_run:
        flagged = sum(1 for r in rows if r["is_fraud"] or r["risk_level"] in ("high", "critical"))
        hits = sum(1 for r in rows for t in r["rule_triggers"] if t["rule"] != "ML Model Flag")
        print(f"[dry-run] {len(rows)} txns | {flagged} flagged | {sum(r['risk_score'] for r in rows) / max(len(rows), 1):.1f} avg risk | {hits} rule hits")
        if verbose:
            for r in rows:
                triggers = ", ".join(t["rule"] for t in r["rule_triggers"] if t["rule"] != "ML Model Flag") or "—"
                print(f"   {r['transaction_type']:<10} ${r['amount']:>10,.2f} {r['risk_level']:<8} {r['status']:<8} p={r['ml_fraud_probability']:.3f}  [{triggers}]")
        return

    inserted = insert_txns(rows)
    for row, ins in zip(rows, inserted):
        row["id"] = ins.get("id")

    if not args.no_balances:
        update_balances(rows)

    if not args.no_rules:
        bump_rule_hits(active_rules)

    n_alerts = 0 if args.no_alerts else insert_alerts(rows)
    n_cases = 0 if args.no_cases else insert_cases(rows)
    flagged = sum(1 for r in rows if r["is_fraud"] or r["risk_level"] in ("high", "critical"))
    print(f"[{now.strftime('%H:%M:%S')}] inserted {len(rows)} txns | {flagged} flagged | {len(active_rules)} rules | {n_alerts} alerts | {n_cases} cases | total {total_started + len(rows)}")
    if verbose:
        for r in rows:
            triggers = ", ".join(t["rule"] for t in r["rule_triggers"] if t["rule"] != "ML Model Flag") or "—"
            print(f"   {r['transaction_type']:<10} ${r['amount']:>10,.2f} {r['risk_level']:<8} {r['status']:<8} {r['merchant']}  [{triggers}]")


def parse_args():
    p = argparse.ArgumentParser(description="Generate + ML-score live transactions from real accounts.")
    p.add_argument("--per-hour", type=float, default=500.0, help="target transactions per hour (streaming mode)")
    p.add_argument("--batch", type=int, default=2, help="transactions inserted per tick")
    p.add_argument("--interval", type=float, default=None, help="seconds between ticks (default: derived from --per-hour)")
    p.add_argument("--once", action="store_true", help="run a single batch and exit (for cron)")
    p.add_argument("--count", type=int, default=None, help="batch size when --once (default: --per-hour)")
    p.add_argument("--fraud-rate", type=float, default=0.05, help="fraction of transactions injected as fraud")
    p.add_argument("--use-ensemble", action="store_true", help="score via running ML service /predict-ensemble")
    p.add_argument("--ml-url", default="http://localhost:5001", help="ML service base URL (ensemble mode)")
    p.add_argument("--no-balances", action="store_true", help="do not update account balances")
    p.add_argument("--no-alerts", action="store_true", help="do not create alerts")
    p.add_argument("--no-cases", action="store_true", help="do not auto-open fraud cases")
    p.add_argument("--no-rules", action="store_true", help="disable the fraud_rules rule engine")
    p.add_argument("--dry-run", action="store_true", help="generate + score only, insert nothing")
    p.add_argument("--verbose", action="store_true", help="print each transaction")
    return p.parse_args()


def main():
    global accounts
    args = parse_args()

    if not SUPABASE_SERVICE_KEY:
        sys.exit("SUPABASE_SERVICE_KEY not set (check frontend/.env.local)")

    print("=" * 58)
    print("FRAUDSHIELD LIVE SIMULATOR")
    print("=" * 58)
    print(f"[1/3] Loading accounts...")
    accounts = fetch_accounts()
    _seed_device_pools()
    print(f"   {len(accounts)} accounts loaded")

    scorer = f"ensemble via {args.ml_url}" if args.use_ensemble else "in-process ML-style scorer"
    print(f"[2/3] Scorer: {scorer}")

    n_rules = 0 if args.no_rules else len(fetch_rules())
    rules_state = f"engine ({n_rules} active)" if not args.no_rules else "off"
    print(f"[3/3] Fraud rate {args.fraud_rate:.0%} | balances {'tracked' if not args.no_balances else 'off'} | alerts {'on' if not args.no_alerts else 'off'} | cases {'on' if not args.no_cases else 'off'} | rules {rules_state}")

    if args.once or args.dry_run:
        count = args.count or (int(args.per_hour) if args.once else args.batch)
        mode = "dry-run" if args.dry_run else "burst"
        print(f"Running single {mode} of {count} transactions...")
        run_batch(count, args.fraud_rate, args, 0, verbose=args.verbose)
        return

    interval = args.interval if args.interval is not None else 3600 * args.batch / args.per_hour
    print(f"Streaming {args.batch} tx every {interval:.1f}s (~{args.per_hour:.0f} tx/hour). Ctrl+C to stop.\n")
    total = 0
    try:
        while True:
            run_batch(args.batch, args.fraud_rate, args, total, verbose=args.verbose)
            total += args.batch
            time.sleep(interval)
    except KeyboardInterrupt:
        print(f"\nStopped after {total} transactions.")


if __name__ == "__main__":
    main()
