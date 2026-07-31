"""
Backfill: seed card transactions + transfers for the demo user-role accounts
so the customer portal (Overview + Transaction History) shows real activity.
Idempotent - safe to run multiple times.
"""
import os, random, json, time
from datetime import datetime, timedelta, timezone
import requests

SUPABASE_URL = "https://cllohfvwvhfncgihrnvx.supabase.co"
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

H = {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
     "Content-Type": "application/json"}

MERCHANTS = [
    ("Amazon.com","E-Commerce"),("Walmart","Retail"),("Target","Retail"),
    ("Best Buy","Electronics"),("Home Depot","Home Improvement"),
    ("Starbucks","Food & Dining"),("McDonald's","Food & Dining"),
    ("Netflix","Entertainment"),("Spotify","Entertainment"),
    ("Uber","Transportation"),("Lyft","Transportation"),
    ("Shell","Gas & Fuel"),("Apple Store","E-Commerce"),
    ("Costco","Retail"),("Walgreens","Pharmacy"),("CVS","Pharmacy"),
    ("Marriott","Travel"),("Hilton","Travel"),
    ("Delta Airlines","Travel"),("AT&T","Telecom"),
]
REGIONS = [
    ("North America","New York","US"),("North America","Los Angeles","US"),
    ("North America","Chicago","US"),("Europe","London","UK"),
    ("Asia Pacific","Tokyo","JP"),("Asia Pacific","Sydney","AU"),
]
CHANNELS = ["online","pos","atm","wire","mobile"]

def rest(method, path, json_data=None, params=None):
    return requests.request(method, f"{SUPABASE_URL}{path}", headers=H,
                            json=json_data, params=params)

def get_all(path, params):
    out = []
    offset = 0
    page = 1000
    while True:
        r = rest("GET", path, params={**params, "limit": page, "offset": offset})
        batch = r.json()
        if not isinstance(batch, list) or not batch:
            break
        out.extend(batch)
        if len(batch) < page:
            break
        offset += page
    return out

def main():
    if not SUPABASE_SERVICE_KEY:
        print("SUPABASE_SERVICE_KEY not set")
        return

    targets = ["test@test.com", "demo.user@banking.demo"]
    all_accs = get_all("/rest/v1/accounts", {"select": "id,user_id,account_number,account_name,balance"})
    all_profs = get_all("/rest/v1/user_profiles", {"select": "id,email,full_name"})
    email_of = {p["id"]: p["email"] for p in all_profs}
    name_of = {p["id"]: p["full_name"] or p["email"] for p in all_profs}

    used_txn_ids = set()
    existing = get_all("/rest/v1/transactions", {"select": "transaction_id,account_id"})
    used_txn_ids |= {t["transaction_id"] for t in existing}
    existing_accounts = set(t["account_id"] for t in existing)

    for email in targets:
        prof = next((p for p in all_profs if p["email"] == email), None)
        if not prof:
            print(f"  {email}: no profile")
            continue
        accs = [a for a in all_accs if a["user_id"] == prof["id"]]
        print(f"\n=== {email} ({prof['id']})")
        for a in accs:
            print(f"  account {a['id']} {a['account_number']} {a['account_name']} bal={a['balance']}")

            if a["account_number"] not in existing_accounts:
                rows = []
                base = datetime.now(timezone.utc) - timedelta(days=30)
                for i in range(40):
                    merchant, mcat = random.choice(MERCHANTS)
                    region, city, country = random.choice(REGIONS)
                    channel = random.choice(CHANNELS)
                    ts = base + timedelta(minutes=i * 37 + random.randint(0, 25))
                    is_fraud = random.random() < 0.05
                    amount = round(random.uniform(5, 8000), 2)
                    if is_fraud:
                        status, rl, rs = "blocked", "critical", round(random.uniform(70, 99), 2)
                    elif amount > 5000:
                        status, rl, rs = "flagged", "high", round(random.uniform(40, 69), 2)
                    else:
                        status = random.choice(["approved", "approved", "approved", "approved", "flagged"])
                        rl = "low" if amount < 500 else "medium"
                        rs = round(random.uniform(0, 30), 2)
                    tx_id = f"TXN-{int(ts.timestamp()*1000)}-{random.randint(100,999)}"
                    while tx_id in used_txn_ids:
                        tx_id = f"TXN-{int(ts.timestamp()*1000)}-{random.randint(100,999)}"
                    used_txn_ids.add(tx_id)
                    rows.append({
                        "transaction_id": tx_id,
                        "account_id": a["account_number"],
                        "account_name": a["account_name"],
                        "card_last_four": str(random.randint(1000,9999)),
                        "amount": amount,
                        "currency": "USD",
                        "merchant": merchant,
                        "merchant_category": mcat,
                        "region": region,
                        "city": city,
                        "country": country,
                        "transaction_type": random.choice(["purchase","withdrawal","payment"]),
                        "channel": channel,
                        "timestamp": ts.isoformat(),
                        "status": status,
                        "risk_score": rs,
                        "risk_level": rl,
                        "is_fraud": is_fraud,
                        "is_suspicious": is_fraud or status == "flagged",
                        "ml_fraud_probability": round(random.uniform(0.6,0.99),4) if is_fraud else round(random.uniform(0,0.2),4),
                        "rule_triggers": "[]",
                        "device_id": f"DEV-{random.randint(10000,99999)}",
                        "ip_address": f"{random.randint(10,223)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}",
                        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0",
                        "latitude": round(random.uniform(-90,90),7),
                        "longitude": round(random.uniform(-180,180),7),
                    })
                for i in range(0, len(rows), 500):
                    r = rest("POST", "/rest/v1/transactions", rows[i:i+500])
                    print(f"    seeded {len(rows)} transactions: {r.status_code}")
                existing_accounts.add(a["account_number"])

    # ── Seed transfers between the demo user-role accounts and real counterparties ──
    counterparties = [
        a for a in all_accs
        if a["user_id"] != "1515-placeholder" and float(a["balance"] or 0) > 500
        and a["account_name"] == "Main Checking" and email_of.get(a["user_id"], "").endswith("@banking.demo")
    ]
    print(f"\n== counterparties available: {len(counterparties)}")

    existing_tr = rest("GET", "/rest/v1/transfers", params={"select": "id", "limit": 100}).json()
    print(f"   existing transfers: {len(existing_tr)}")

    for email in targets:
        prof = next((p for p in all_profs if p["email"] == email), None)
        if not prof:
            continue
        accs = [a for a in all_accs if a["user_id"] == prof["id"] and a["account_name"] == "Main Checking"]
        if not accs:
            continue
        mine = accs[0]
        # create 6 transfers: 3 sent to counterparties, 3 received from counterparties
        rows = []
        base = datetime.now(timezone.utc) - timedelta(hours=72)
        for i, other in enumerate(random.sample(counterparties, min(3, len(counterparties)))):
            rows.append({
                "sender_account_id": mine["id"],
                "receiver_account_id": other["id"],
                "sender_name": name_of[prof["id"]],
                "receiver_name": name_of[other["user_id"]],
                "amount": round(random.uniform(50, 2000), 2),
                "note": random.choice(["Dinner split", "Rent", "Utilities", "Groceries", "Invoice #284", ""]),
                "status": "completed",
                "created_at": (base + timedelta(hours=i * 9 + 2)).isoformat(),
            })
            rows.append({
                "sender_account_id": other["id"],
                "receiver_account_id": mine["id"],
                "sender_name": name_of[other["user_id"]],
                "receiver_name": name_of[prof["id"]],
                "amount": round(random.uniform(50, 2000), 2),
                "note": random.choice(["Payment", "Reimbursement", "Gift", "Invoice #402", ""]),
                "status": "completed",
                "created_at": (base + timedelta(hours=i * 9 + 5)).isoformat(),
            })
        for row in rows:
            r = rest("POST", "/rest/v1/transfers", row)
            if r.status_code not in (200, 201):
                print(f"    transfer insert failed: {r.status_code} {r.text[:120]}")
        print(f"  seeded {len(rows)} transfers for {email}")

    print("\nDONE")

if __name__ == "__main__":
    main()
