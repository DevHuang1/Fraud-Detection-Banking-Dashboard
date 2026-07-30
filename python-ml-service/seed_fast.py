"""
Seed script: 100 users, synthetic transactions, no CSV dependency.
"""
import os, json, random, uuid, time
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

SUPABASE_URL = "https://cllohfvwvhfncgihrnvx.supabase.co"
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

NUM_USERS = 100
TX_PER_USER = 250

MERCHANTS = [
    ("Amazon.com","E-Commerce"),("Walmart","Retail"),("Target","Retail"),
    ("Best Buy","Electronics"),("Home Depot","Home Improvement"),
    ("Starbucks","Food & Dining"),("McDonald's","Food & Dining"),
    ("Netflix","Entertainment"),("Spotify","Entertainment"),
    ("Uber","Transportation"),("Lyft","Transportation"),
    ("Shell","Gas & Fuel"),("Apple Store","E-Commerce"),
    ("Costco","Retail"),("Walgreens","Pharmacy"),("CVS","Pharmacy"),
    ("Marriott","Travel"),("Hilton","Travel"),
    ("Delta Airlines","Travel"),("CryptoExchange.io","Cryptocurrency"),
    ("Western Union","Money Transfer"),("PayPal","Digital Wallet"),
    ("Venmo","Digital Wallet"),("AT&T","Telecom"),
]
REGIONS = [
    ("North America","New York","US"),("North America","Los Angeles","US"),
    ("North America","Chicago","US"),("Europe","London","UK"),
    ("Europe","Paris","FR"),("Europe","Berlin","DE"),
    ("Asia Pacific","Tokyo","JP"),("Asia Pacific","Sydney","AU"),
    ("Asia Pacific","Singapore","SG"),("Asia Pacific","Mumbai","IN"),
    ("LATAM","Sao Paulo","BR"),("Africa","Lagos","NG"),
]
CHANNELS = ["online","pos","atm","wire","mobile"]
CURRENCIES = ["USD","EUR","GBP","CAD"]
FIRST_NAMES = ["Alice","Bob","Charlie","Diana","Edward","Fiona","George","Hannah",
    "Ivan","Julia","Kevin","Laura","Michael","Nina","Oscar","Patricia","Quinn",
    "Rachel","Samuel","Tina","Uma","Victor","Wendy","Xavier","Yvonne","Aaron",
    "Bella","Carlos","Daphne","Eli","Faith","Gavin","Hazel","Isaac","Jasmine",
    "Kyle","Liam","Maya","Nathan","Olivia","Peter","Rosa","Sam","Tara"]
SURNAMES = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis",
    "Rodriguez","Martinez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson",
    "Martin","Lee","Thompson","White","Harris","Clark","Lewis","Robinson"]

H = {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
     "Content-Type": "application/json"}

def rest(method, path, json_data=None):
    r = requests.request(method, f"{SUPABASE_URL}{path}", headers=H, json=json_data)
    return r

def random_email():
    return f"{random.choice(FIRST_NAMES).lower()}.{random.choice(SURNAMES).lower()}{random.randint(1,999)}@demo.bank"

def create_auth_user(email):
    r = rest("POST", "/auth/v1/admin/users", {
        "email": email, "password": "Demo@123456", "email_confirm": True})
    if r.status_code == 200:
        return r.json()["id"]
    return None

def main():
    t_start = time.time()
    print("=" * 55)
    print("FRAUD DASHBOARD SEED")
    print("=" * 55)

    # ── Step 1: Auth users (parallel) ──
    print(f"\n[1/5] Creating {NUM_USERS} auth users...")
    user_ids = [None] * NUM_USERS
    with ThreadPoolExecutor(max_workers=20) as pool:
        futures = {}
        for i in range(NUM_USERS):
            email = random_email()
            f = pool.submit(create_auth_user, email)
            futures[f] = (i, email)
        for f in as_completed(futures):
            i, email = futures[f]
            uid = f.result()
            user_ids[i] = (email, uid)
    created = sum(1 for _, uid in user_ids if uid)
    print(f"   {created}/{NUM_USERS} created ({time.time()-t_start:.1f}s)")

    # ── Step 2: Profiles + Accounts ──
    print(f"\n[2/5] Creating profiles & accounts...")
    valid = [(e, u) for e, u in user_ids if u]
    now = datetime.now(timezone.utc).isoformat()
    used_acc = set()
    profiles = []
    accounts = []

    for email, uid in valid:
        name = f"{random.choice(FIRST_NAMES)} {random.choice(SURNAMES)}"
        role = random.choices(["user","user","user","analyst","investigator","admin"],
                              weights=[40,30,10,10,7,3])[0]
        profiles.append({"id": uid, "email": email, "full_name": name, "role": role,
                         "avatar_url": f"https://api.dicebear.com/7.x/initials/svg?seed={name}",
                         "created_at": now})
        for acct in random.sample(["Main Checking","Savings","Credit Card"], random.randint(1,2)):
            while True:
                an = f"ACC-{random.randint(10000,99999)}"
                if an not in used_acc:
                    used_acc.add(an)
                    break
            accounts.append({"user_id": uid, "account_name": acct, "account_number": an,
                             "balance": round(random.uniform(100, 500000), 2),
                             "currency": random.choice(CURRENCIES)})

    r1 = rest("POST", "/rest/v1/user_profiles", profiles)
    print(f"   user_profiles: {r1.status_code} ({len(profiles)} rows)")
    r2 = rest("POST", "/rest/v1/accounts", accounts)
    print(f"   accounts: {r2.status_code} ({len(accounts)} rows)")

    # Build lookup maps
    uid_to_prof = {p["id"]: p for p in profiles}
    uid_to_accts = {}
    for uid in uid_to_prof:
        uid_to_accts[uid] = [a for a in accounts if a["user_id"] == uid]

    valid_uids = [uid for uid, a in uid_to_accts.items() if a]
    print(f"   {len(valid_uids)} users with accounts ready for transactions")

    # ── Step 3: Generate transactions ──
    print(f"\n[3/5] Generating {NUM_USERS * TX_PER_USER} transactions...")
    total = NUM_USERS * TX_PER_USER
    base = datetime.now(timezone.utc) - timedelta(days=30)
    txns = []

    for i in range(total):
        uid = random.choice(valid_uids)
        acct = random.choice(uid_to_accts[uid])
        merchant, mcat = random.choice(MERCHANTS)
        region, city, country = random.choice(REGIONS)
        channel = random.choice(CHANNELS)
        ts = base + timedelta(minutes=i)

        # ~5% fraud rate
        is_fraud = random.random() < 0.05
        amount = round(random.uniform(5, 25000), 2) if not is_fraud else round(random.uniform(500, 50000), 2)

        if is_fraud:
            status, rl, rs = "blocked", "critical", round(random.uniform(70, 99), 2)
        elif amount > 10000:
            status, rl, rs = "flagged", "high", round(random.uniform(40, 69), 2)
        else:
            status = random.choices(["approved","approved","approved","flagged","blocked"], [60,20,10,5,5])[0]
            rl = "low" if amount < 500 else "medium"
            rs = round(random.uniform(0, 30), 2)

        ml_prob = round(random.uniform(0.6, 0.99), 4) if is_fraud else round(random.uniform(0, 0.2), 4)
        tx_id = f"TXN-{int(ts.timestamp()*1000)}-{random.randint(100,999)}"

        txns.append({
            "transaction_id": tx_id,
            "account_id": acct["account_number"],
            "account_name": acct["account_name"],
            "card_last_four": str(random.randint(1000,9999)),
            "amount": amount,
            "currency": "USD",
            "merchant": merchant,
            "merchant_category": mcat,
            "region": region,
            "city": city,
            "country": country,
            "transaction_type": random.choice(["purchase","transfer","withdrawal","deposit","payment"]),
            "channel": channel,
            "timestamp": ts.isoformat(),
            "status": status,
            "risk_score": rs,
            "risk_level": rl,
            "is_fraud": is_fraud,
            "is_suspicious": is_fraud or status == "flagged",
            "ml_fraud_probability": ml_prob,
            "rule_triggers": "[]",
            "device_id": f"DEV-{random.randint(10000,99999)}",
            "ip_address": f"{random.randint(10,223)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}",
            "user_agent": random.choice([
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1",
            ]),
            "latitude": round(random.uniform(-90, 90), 7),
            "longitude": round(random.uniform(-180, 180), 7),
        })
        if (i+1) % 10000 == 0:
            print(f"   ... {i+1}/{total}", end="\r")
    print(f"   Generated {len(txns)} transactions ({time.time()-t_start:.1f}s)")

    # ── Step 4: Alerts + Fraud Cases ──
    print(f"\n[4/5] Generating alerts & fraud cases...")
    fraud_txns = [t for t in txns if t["is_fraud"] or t["risk_level"] in ("high","critical")]
    alerts = []
    cases = []
    case_num = 1

    for tx in fraud_txns[:300]:
        atype = random.choice(["fraud_detected","rule_triggered","anomaly","high_risk","velocity","geo_anomaly"])
        alerts.append({
            "alert_type": atype,
            "severity": "critical" if tx["risk_level"] == "critical" else "warning",
            "title": f"{atype.replace('_',' ').title()} — ${tx['amount']:,.2f}",
            "message": f"Txn {tx['transaction_id']} at {tx['merchant']}",
            "is_read": random.random() < 0.3,
            "created_at": tx["timestamp"],
        })
        if tx["is_fraud"] or random.random() < 0.3:
            assignee = random.choice(profiles)
            cases.append({
                "case_number": f"FC-2024-{case_num:03d}",
                "title": f"Fraud: {tx['merchant']}",
                "description": f"${tx['amount']:,.2f} at {tx['merchant']} — {tx['risk_level']} risk",
                "severity": tx["risk_level"],
                "status": random.choice(["open","open","investigating","resolved"]),
                "assigned_to": assignee["id"],
                "assigned_by": assignee["id"],
                "fraud_type": random.choice(["account_takeover","rapid_cashout","geo_anomaly","wire_fraud","card_not_present"]),
                "amount_at_risk": tx["amount"],
                "is_confirmed_fraud": tx["is_fraud"] and random.random() < 0.7,
                "created_at": tx["timestamp"],
            })
            case_num += 1
    print(f"   {len(alerts)} alerts, {len(cases)} fraud cases")

    # ── Step 5: Batch insert ──
    print(f"\n[5/5] Inserting into Supabase...")
    for table, records in [("transactions", txns), ("alerts", alerts), ("fraud_cases", cases)]:
        for i in range(0, len(records), 500):
            r = rest("POST", f"/rest/v1/{table}", records[i:i+500])
            if r.status_code not in (200, 201):
                print(f"   {table}[{i//500}]: {r.status_code} {r.text[:80]}")
        print(f"   {table}: {len(records)} rows")

    print("\n" + "=" * 55)
    print(f"✅ SEED COMPLETE ({time.time()-t_start:.1f}s)")
    print(f"   {len(profiles)} users  |  {len(accounts)} accounts")
    print(f"   {len(txns)} txns      |  {len(alerts)} alerts  |  {len(cases)} cases")
    print("=" * 55)

if __name__ == "__main__":
    main()
