"""
Backfill rule_triggers for transactions that currently store empty/double-encoded
triggers. Triggers are derived from each row's attributes (is_fraud, status,
risk_level, amount) and stored as a proper jsonb array.

Clean, low-risk transactions keep an empty trigger list ("No rules triggered").

Run once:
  export SUPABASE_SERVICE_KEY=your-service-role-key
  python3 backfill_rule_triggers.py
"""
import os, json, time
import requests

SUPABASE_URL = "https://cllohfvwvhfncgihrnvx.supabase.co"
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

H = {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
     "Content-Type": "application/json"}

_session = requests.Session()


def compute_triggers(row: dict) -> list[dict]:
    status = row.get("status")
    risk = row.get("risk_level")
    amount = row.get("amount") or 0
    is_fraud = row.get("is_fraud") or False

    suspicious = is_fraud or status in ("blocked", "flagged") or risk in ("high", "critical")
    if not suspicious:
        return []

    triggers = []
    if is_fraud:
        triggers.append({"rule": "Confirmed Fraud Pattern", "severity": "critical"})
    if risk == "critical":
        triggers.append({"rule": "Critical Risk Score", "severity": "critical"})
    elif risk == "high":
        triggers.append({"rule": "High Risk Score", "severity": "high"})
    elif risk == "medium":
        triggers.append({"rule": "Elevated Risk Score", "severity": "medium"})

    if amount >= 10000:
        triggers.append({"rule": "High-Value Threshold", "severity": "high"})
    elif amount >= 2500:
        triggers.append({"rule": "Unusual Spend Volume", "severity": "medium"})

    if status == "blocked":
        triggers.append({"rule": "Blocked by Rule Engine", "severity": "critical"})
    elif status == "flagged":
        triggers.append({"rule": "Velocity Anomaly", "severity": "medium"})

    if row.get("channel") == "wire" or (row.get("transaction_type") == "transfer" and amount >= 5000):
        triggers.append({"rule": "Large Wire Transfer", "severity": "medium"})

    return triggers


def fetch_all():
    rows = []
    offset = 0
    while True:
        r = _session.get(f"{SUPABASE_URL}/rest/v1/transactions", headers=H,
                         params={"select": "id,status,risk_level,amount,is_fraud,channel,transaction_type",
                                 "limit": 1000, "offset": offset, "order": "id.asc"})
        page = r.json()
        if not page:
            break
        rows.extend(page)
        offset += 1000
        if len(page) < 1000:
            break
    return rows


def is_empty(raw) -> bool:
    value = raw
    for _ in range(2):
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except Exception:
                return True
        else:
            break
    return not isinstance(value, list) or len(value) == 0


def main():
    if not SUPABASE_SERVICE_KEY:
        print("SUPABASE_SERVICE_KEY not set — aborting")
        return

    t0 = time.time()
    rows = fetch_all()
    print(f"fetched {len(rows)} rows ({time.time()-t0:.1f}s)")

    groups: dict[str, list] = {}
    empty_kept = 0
    for row in rows:
        if is_empty(row.get("rule_triggers")):
            triggers = compute_triggers(row)
            key = json.dumps(triggers, separators=(",", ":"))
            groups.setdefault(key, []).append(row["id"])
        else:
            empty_kept += 1
    print(f"{sum(len(v) for v in groups.values())} rows to update, {empty_kept} already populated")

    t0 = time.time()
    ok = fails = 0
    for key, ids in groups.items():
        triggers = json.loads(key)
        if not triggers:
            continue
        for i in range(0, len(ids), 500):
            chunk = ids[i : i + 500]
            url = f"{SUPABASE_URL}/rest/v1/transactions?id=in.({','.join(map(str, chunk))})"
            r = _session.patch(url, headers=H, json={"rule_triggers": triggers}, timeout=(3, 60))
            if r.status_code in (200, 204):
                ok += len(chunk)
            else:
                fails += len(chunk)
                print(f"  group {key[:60]!r}: HTTP {r.status_code} {r.text[:120]}")
    print(f"updated {ok} rows, {fails} failed ({time.time()-t0:.1f}s)")


if __name__ == "__main__":
    main()
