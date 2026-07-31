"""
Seed script: Downloads a Hugging Face fraud dataset, generates 200 users,
runs Hugging Face transformers + existing Keras model for fraud scoring,
and inserts everything into Supabase.

Usage:
  export SUPABASE_URL="https://cllohfvwvhfncgihrnvx.supabase.co"
  export SUPABASE_SERVICE_KEY="your-service-role-key"
  python3 seed_from_hf.py
"""

import os
import sys
import uuid
import random
import math
import json
import hashlib
from datetime import datetime, timedelta
from typing import Any
from concurrent.futures import ThreadPoolExecutor, as_completed

# Supabase client
try:
    from supabase import create_client as create_supabase_client
    SUPABASE_CLIENT_AVAILABLE = True
except ImportError:
    SUPABASE_CLIENT_AVAILABLE = False

# Load .env files (check multiple locations)
_env_candidates = [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"),
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", ".env.local"),
]
for _env_path in _env_candidates:
    if os.path.exists(_env_path):
        with open(_env_path) as _f:
            for _line in _f:
                _line = _line.strip()
                if _line and not _line.startswith("#") and "=" in _line:
                    k, v = _line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

import numpy as np
import pandas as pd
import requests

# ── Hugging Face / ML ──────────────────────────────────────────────
TRANSFORMER_AVAILABLE = False
try:
    from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
    import torch
    TRANSFORMER_AVAILABLE = True
except ImportError:
    print("[warn] transformers/torch not installed — will skip HF transformer scoring")

KERAS_AVAILABLE = False
try:
    import keras
    import joblib
    KERAS_AVAILABLE = True
except ImportError:
    print("[warn] keras/joblib not installed — will skip Keras model scoring")


# ── Configuration ──────────────────────────────────────────────────
SUPABASE_URL = (
    os.environ.get("SUPABASE_URL")
    or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    or "https://cllohfvwvhfncgihrnvx.supabase.co"
)
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

NUM_USERS = 200
MIN_TX_PER_USER = 100
MAX_TX_PER_USER = 250
FRAUD_RATIO = 0.01  # ~1% fraud
SPAN_DAYS = 30  # spread transaction timestamps across the last N days

CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"]
MERCHANTS = [
    ("Amazon.com", "E-Commerce"), ("Walmart", "Retail"), ("Target", "Retail"),
    ("Best Buy", "Electronics"), ("Home Depot", "Home Improvement"),
    ("Starbucks", "Food & Dining"), ("McDonald's", "Food & Dining"),
    ("Netflix", "Entertainment"), ("Spotify", "Entertainment"),
    ("Uber", "Transportation"), ("Lyft", "Transportation"),
    ("ExxonMobil", "Gas & Fuel"), ("Shell", "Gas & Fuel"),
    ("Apple Store", "E-Commerce"), ("Google Play", "Entertainment"),
    ("Costco", "Retail"), ("Trader Joe's", "Grocery"),
    ("Walgreens", "Pharmacy"), ("CVS", "Pharmacy"),
    ("Marriott", "Travel"), ("Hilton", "Travel"),
    ("Delta Airlines", "Travel"), ("American Airlines", "Travel"),
    ("CryptoExchange.io", "Cryptocurrency"), ("Coinbase", "Cryptocurrency"),
    ("Western Union", "Money Transfer"), ("HSBC Intl Transfer", "Wire Transfer"),
    ("PayPal", "Digital Wallet"), ("Venmo", "Digital Wallet"),
    ("AT&T", "Telecom"), ("Verizon", "Telecom"),
    ("Comcast", "Utilities"), ("PG&E", "Utilities"),
]
REGIONS = [
    ("North America", "New York", "US"), ("North America", "Los Angeles", "US"),
    ("North America", "Chicago", "US"), ("North America", "Houston", "US"),
    ("Europe", "London", "UK"), ("Europe", "Paris", "FR"),
    ("Europe", "Berlin", "DE"), ("Europe", "Madrid", "ES"),
    ("Asia Pacific", "Tokyo", "JP"), ("Asia Pacific", "Sydney", "AU"),
    ("Asia Pacific", "Singapore", "SG"), ("Asia Pacific", "Mumbai", "IN"),
    ("LATAM", "Sao Paulo", "BR"), ("LATAM", "Buenos Aires", "AR"),
    ("LATAM", "Mexico City", "MX"), ("Africa", "Lagos", "NG"),
    ("Africa", "Johannesburg", "ZA"), ("Africa", "Nairobi", "KE"),
]
CHANNELS = ["online", "pos", "atm", "wire", "mobile"]
TX_TYPES = ["purchase", "transfer", "withdrawal", "deposit", "payment"]
STATUSES = ["approved", "approved", "approved", "approved", "flagged", "blocked"]

FIRST_NAMES = [
    "Alice", "Bob", "Charlie", "Diana", "Edward", "Fiona", "George", "Hannah",
    "Ivan", "Julia", "Kevin", "Laura", "Michael", "Nina", "Oscar", "Patricia",
    "Quinn", "Rachel", "Samuel", "Tina", "Uma", "Victor", "Wendy", "Xavier",
    "Yvonne", "Zachary", "Aaron", "Bella", "Carlos", "Daphne",
    "Eli", "Faith", "Gavin", "Hazel", "Isaac", "Jasmine", "Kyle", "Liam",
    "Maya", "Nathan", "Olivia", "Peter", "Quincy", "Rosa", "Sam", "Tara",
    "Uma", "Vince", "Whitney", "Xander", "Yara", "Zane",
    "Aiden", "Bianca", "Caleb", "Danielle", "Ethan", "Freya", "Gianna",
    "Harper", "Iris", "Jaden", "Kai", "Leila", "Miles", "Nadia", "Orion",
    "Paige", "Ryder", "Sage", "Theo", "Valeria", "Wade", "Xiomara",
]

SURNAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Wilson",
    "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee",
    "Thompson", "White", "Harris", "Clark", "Lewis", "Robinson", "Walker",
    "Young", "Allen", "King", "Wright", "Scott", "Hill", "Green", "Adams",
    "Baker", "Nelson", "Carter", "Mitchell", "Perez", "Roberts", "Turner",
    "Phillips", "Campbell", "Parker", "Evans", "Edwards", "Collins", "Stewart",
]


# ── Helpers ────────────────────────────────────────────────────────
def make_uuid() -> str:
    return str(uuid.uuid4())


def hash_to_int(s: str, mod: int = 10000) -> int:
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16) % mod


def pick_weighted(items: list, weights: list | None = None) -> Any:
    if weights is None:
        return random.choice(items)
    return random.choices(items, weights=weights, k=1)[0]


# ── ML Models ──────────────────────────────────────────────────────
class FraudScorer:
    """Combines Keras model + Hugging Face transformer for fraud scoring."""

    def __init__(self):
        self.keras_model = None
        self.scaler = None
        self.label_encoder = None
        self.transformer_pipeline = None
        self.transformer_tokenizer = None
        self.transformer_model = None
        self._load_models()

    def _load_models(self):
        base = os.path.dirname(os.path.abspath(__file__))

        # Keras model
        if KERAS_AVAILABLE:
            model_path = os.path.join(base, "model.h5")
            scaler_path = os.path.join(base, "preprocessor", "scaler.pkl")
            encoder_path = os.path.join(base, "preprocessor", "label_encoder.pkl")
            if os.path.exists(model_path) and os.path.exists(scaler_path):
                try:
                    self.keras_model = keras.models.load_model(model_path)
                    self.scaler = joblib.load(scaler_path)
                    self.label_encoder = joblib.load(encoder_path)
                    print(f"[ml] Keras model loaded: {model_path}")
                except Exception as e:
                    print(f"[ml] Keras load failed: {e}")

        # Hugging Face transformer
        if TRANSFORMER_AVAILABLE:
            try:
                model_name = "distilbert-base-uncased"
                self.transformer_tokenizer = AutoTokenizer.from_pretrained(model_name)
                # We'll use a lightweight classification head
                self.transformer_model = AutoModelForSequenceClassification.from_pretrained(
                    model_name, num_labels=2
                )
                self.transformer_pipeline = pipeline(
                    "text-classification",
                    model=self.transformer_model,
                    tokenizer=self.transformer_tokenizer,
                )
                print(f"[ml] HF transformer loaded: {model_name}")
            except Exception as e:
                print(f"[ml] HF transformer load failed: {e}")

    def score_keras(self, row: dict) -> float:
        """Keras model score (0-1 fraud probability)."""
        if self.keras_model is None or self.scaler is None:
            return row.get("isFraud", 0) * 0.9 + 0.05

        TYPE_MAP = {"CASH_IN": 0, "CASH_OUT": 1, "DEBIT": 2, "PAYMENT": 3, "TRANSFER": 4}
        FEATURE_COLS = [
            "step", "type_encoded", "amount", "oldbalanceOrg",
            "newbalanceOrig", "oldbalanceDest", "newbalanceDest", "isFlaggedFraud",
        ]

        t = row.get("type", "PAYMENT")
        type_enc = TYPE_MAP.get(t, 3)
        raw = [[
            row.get("step", 0) % 743,
            type_enc,
            row.get("amount", 0),
            row.get("oldbalanceOrg", 0),
            row.get("newbalanceOrig", 0),
            row.get("oldbalanceDest", 0),
            row.get("newbalanceDest", 0),
            row.get("isFlaggedFraud", 0),
        ]]
        df = pd.DataFrame(raw, columns=FEATURE_COLS)
        scaled = self.scaler.transform(df)
        probs = self.keras_model.predict(scaled, verbose=0)[0]
        return float(probs[1])

    def score_transformer(self, row: dict) -> float:
        """HF transformer score based on transaction text description."""
        if self.transformer_pipeline is None:
            return row.get("isFraud", 0) * 0.8 + 0.1

        text = (
            f"Transaction of ${row.get('amount', 0):.2f}. "
            f"Type: {row.get('type', 'purchase')}. "
            f"Merchant: {row.get('merchant', 'Unknown')}. "
            f"Channel: {row.get('channel', 'online')}. "
            f"Region: {row.get('region', 'Unknown')}."
        )
        try:
            result = self.transformer_pipeline(text, return_all_scores=False)
            if result and isinstance(result, list):
                score = result[0]
                if score["label"].lower() == "fraud" or score["label"].lower() == "label_1":
                    return float(score["score"])
                return 1.0 - float(score["score"])
        except Exception:
            pass
        return row.get("isFraud", 0) * 0.8 + 0.1

    def combined_score(self, row: dict) -> tuple[float, float, str]:
        """Returns (fraud_probability, risk_score_0-100, risk_level)."""
        k = self.score_keras(row)
        t = self.score_transformer(row)
        prob = 0.6 * k + 0.4 * t  # weighted ensemble

        risk_score = round(prob * 100, 2)
        if risk_score >= 70:
            level = "critical"
        elif risk_score >= 40:
            level = "high"
        elif risk_score >= 15:
            level = "medium"
        else:
            level = "low"
        return prob, risk_score, level


# ── Data Generation ────────────────────────────────────────────────
def generate_users() -> list[dict]:
    """Generate NUM_USERS synthetic user profiles."""
    users = []
    roles = ["user", "user", "user", "user", "analyst", "analyst", "investigator", "admin"]
    for i in range(NUM_USERS):
        uid = make_uuid()
        first = random.choice(FIRST_NAMES)
        last = random.choice(SURNAMES)
        email = f"{first.lower()}.{last.lower()}{random.randint(1, 999)}@banking.demo"
        users.append({
            "id": uid,
            "email": email,
            "full_name": f"{first} {last}",
            "role": random.choice(roles),
            "avatar_url": f"https://api.dicebear.com/7.x/initials/svg?seed={first}+{last}",
            "created_at": (datetime.now() - timedelta(days=random.randint(30, 730))).isoformat(),
        })
    print(f"[gen] Generated {len(users)} users")
    return users


def generate_accounts(users: list[dict]) -> list[dict]:
    """Generate 1-3 accounts per user with unique account numbers."""
    accounts = []
    acct_types = ["Main Checking", "Savings", "Credit Card", "Investment", "Business"]
    used_numbers = set()
    for u in users:
        num = random.randint(1, 3)
        chosen = random.sample(acct_types, num)
        for i, name in enumerate(chosen):
            while True:
                acc_num = f"ACC-{random.randint(10000, 99999)}"
                if acc_num not in used_numbers:
                    used_numbers.add(acc_num)
                    break
            accounts.append({
                "user_id": u["id"],
                "account_name": name,
                "account_number": acc_num,
                "balance": round(random.uniform(100, 500000), 2),
                "currency": random.choice(CURRENCIES),
            })
    print(f"[gen] Generated {len(accounts)} accounts")
    return accounts


def map_type_to_tx_type(t: str) -> str:
    mapping = {
        "CASH_IN": "deposit",
        "CASH_OUT": "withdrawal",
        "PAYMENT": "purchase",
        "TRANSFER": "transfer",
        "DEBIT": "payment",
    }
    return mapping.get(t, "purchase")


def map_type_to_channel(t: str) -> str:
    mapping = {
        "CASH_IN": "mobile",
        "CASH_OUT": "atm",
        "PAYMENT": "online",
        "TRANSFER": "wire",
        "DEBIT": "pos",
    }
    return mapping.get(t, "online")


def step_ts(step_index: int, total_steps: int) -> datetime:
    """Map a step index to a timestamp spread across the last SPAN_DAYS days."""
    days_back = SPAN_DAYS * (total_steps - 1 - step_index) / max(total_steps - 1, 1)
    base = datetime.now() - timedelta(days=days_back)
    return base + timedelta(seconds=random.randint(0, 86399))


def parse_paysim_row(
    row: dict,
    user_accounts: list[dict],
    all_accounts: list[dict],
    step_time_map: dict,
    total_steps: int,
    scorer: FraudScorer | None,
) -> dict | None:
    """Transform one PaySim row to the project's transaction schema."""
    is_fraud = bool(row.get("isFraud", 0))
    is_flagged = bool(row.get("isFlaggedFraud", 0))

    # Pick a random user account as the account_id
    acct = random.choice(user_accounts) if user_accounts else all_accounts[0]
    if not acct:
        return None

    merchant_info = random.choice(MERCHANTS)
    region_info = random.choice(REGIONS)
    channel = map_type_to_channel(row.get("type", "PAYMENT"))
    tx_type = map_type_to_tx_type(row.get("type", "PAYMENT"))

    # Compute status
    if is_fraud:
        status = "blocked"
    elif is_flagged:
        status = "flagged"
    else:
        status = random.choice(["approved", "approved", "approved", "approved", "flagged"])

    # Timestamp from step number: spread all rows across the last SPAN_DAYS
    step = int(row.get("step", 0))
    idx = step_time_map.get(step, 0)
    ts = step_ts(idx, total_steps)

    # Unique transaction ID
    tx_id = f"TXN-{int(ts.timestamp() * 1000000) % 10000000:07d}-{random.randint(100, 999)}"

    # Build the row for ML scoring
    ml_row = {**row, "merchant": merchant_info[0], "channel": channel,
              "region": region_info[0]}

    # Default ML values
    ml_fraud_prob = row.get("isFraud", 0) * 0.9 + 0.05
    risk_score = round(row.get("isFraud", 0) * 80 + random.uniform(0, 20), 2)
    risk_level = "low"
    if risk_score >= 70:
        risk_level = "critical"
    elif risk_score >= 40:
        risk_level = "high"
    elif risk_score >= 15:
        risk_level = "medium"

    if scorer and is_fraud:
        prob, score, level = scorer.combined_score(ml_row)
        ml_fraud_prob = round(prob, 4)
        risk_score = score
        risk_level = level

    device_id = f"DEV-{hash_to_int(acct['account_number'], 99999):05d}"

    return {
        "transaction_id": tx_id,
        "account_id": acct.get("account_number", f"ACC-{random.randint(10000, 99999)}"),
        "account_name": acct.get("account_name", "Main Checking"),
        "card_last_four": f"{random.randint(1000, 9999)}",
        "amount": round(float(row.get("amount", 0)), 2),
        "currency": random.choice(CURRENCIES),
        "merchant": merchant_info[0],
        "merchant_category": merchant_info[1],
        "region": region_info[0],
        "city": region_info[1],
        "country": region_info[2],
        "transaction_type": tx_type,
        "channel": channel,
        "timestamp": ts.isoformat(),
        "status": status,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "is_fraud": is_fraud,
        "is_suspicious": is_fraud or is_flagged,
        "ml_fraud_probability": ml_fraud_prob,
        "rule_triggers": json.dumps([] if not is_fraud else [
            {"rule": "High-Value Threshold", "severity": "high"},
            {"rule": "Geo Anomaly", "severity": "medium"},
        ]),
        "device_id": device_id,
        "ip_address": f"{random.randint(10, 223)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}",
        "user_agent": random.choice([
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1",
            "Mozilla/5.0 (Linux; Android 14) Chrome/120.0",
        ]),
        "latitude": round(random.uniform(-90, 90), 7),
        "longitude": round(random.uniform(-180, 180), 7),
    }


def generate_transactions(
    paysim_path: str,
    users: list[dict],
    accounts: list[dict],
    scorer: FraudScorer | None,
    max_rows: int = 100000,
) -> list[dict]:
    """Read PaySim CSV and generate transformed transaction records."""
    # Map users to their accounts
    user_account_map: dict[str, list[dict]] = {}
    for acct in accounts:
        uid = acct["user_id"]
        if uid not in user_account_map:
            user_account_map[uid] = []
        user_account_map[uid].append(acct)

    all_accounts = accounts

    print(f"[gen] Reading PaySim data from {paysim_path}...")
    steps_seen: set[int] = set()
    for chunk in pd.read_csv(paysim_path, chunksize=100000, usecols=["step"]):
        steps_seen.update(int(s) for s in chunk["step"].dropna().unique())
    distinct_steps = sorted(steps_seen)
    step_time_map = {s: i for i, s in enumerate(distinct_steps)}
    total_steps = max(len(distinct_steps), 1)
    print(f"[gen] {total_steps} distinct steps — timestamps spread over last {SPAN_DAYS} days")

    transactions = []
    total_rows = 0

    reader = pd.read_csv(paysim_path, chunksize=50000)
    target = NUM_USERS * MAX_TX_PER_USER

    for chunk in reader:
        if total_rows >= target:
            break

        # Assign each row to a random user
        for _, row in chunk.iterrows():
            if total_rows >= target:
                break

            user = random.choice(users)
            user_accs = user_account_map.get(user["id"], [])
            tx = parse_paysim_row(row.to_dict(), user_accs, all_accounts, step_time_map, total_steps, scorer)
            if tx:
                transactions.append(tx)
                total_rows += 1

        print(f"  ... {total_rows}/{target} transactions generated")

    print(f"[gen] Generated {len(transactions)} transactions")
    return transactions


# ── Supabase Insert ────────────────────────────────────────────────
def create_auth_users(users: list[dict]) -> list[dict]:
    """Create auth.users via Supabase Admin API in parallel."""
    if not SUPABASE_SERVICE_KEY:
        print("[db] SKIP auth users: no SUPABASE_SERVICE_KEY set")
        return []

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    base_url = f"{SUPABASE_URL}/auth/v1/admin/users"
    results = [None] * len(users)

    def create_one(i: int, u: dict) -> tuple[int, dict | None]:
        resp = requests.post(
            base_url,
            headers=headers,
            json={
                "email": u["email"],
                "password": "DemoPass123!",
                "email_confirm": True,
                "user_metadata": {
                    "full_name": u["full_name"],
                    "role": u["role"],
                },
            },
        )
        if resp.status_code in (200, 201):
            return i, {**u, "id": resp.json()["id"]}
        if resp.status_code == 422:
            try:
                err = resp.json()
                if "already exists" in str(err).lower():
                    r2 = requests.get(f"{base_url}?email={u['email']}", headers=headers)
                    if r2.status_code == 200:
                        existing = r2.json().get("users", [])
                        if existing:
                            return i, {**u, "id": existing[0]["id"]}
            except Exception:
                pass
        return i, None

    with ThreadPoolExecutor(max_workers=20) as pool:
        fut = {pool.submit(create_one, i, u): i for i, u in enumerate(users)}
        for f in as_completed(fut):
            i, result = f.result()
            if result:
                results[i] = result

    created = [r for r in results if r is not None]
    print(f"[db] Created/found {len(created)} / {len(users)} auth users")
    return created


def supabase_insert(table: str, records: list[dict], batch_size: int = 500):
    """Insert records into Supabase via REST API (service_role bypasses RLS)."""
    if not SUPABASE_SERVICE_KEY:
        print(f"[db] SKIP {table}: no SUPABASE_SERVICE_KEY set")
        return

    if not records:
        print(f"[db] SKIP {table}: no records")
        return

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    total = len(records)
    inserted = 0
    for i in range(0, total, batch_size):
        batch = records[i : i + batch_size]
        url = f"{SUPABASE_URL}/rest/v1/{table}"
        resp = requests.post(url, headers=headers, json=batch)
        if resp.status_code in (200, 201, 204):
            inserted += len(batch)
        else:
            # Try individual inserts on conflict
            failed = 0
            for row in batch:
                r2 = requests.post(url, headers={**headers, "Prefer": "resolution=merge-duplicates"}, json=[row])
                if r2.status_code not in (200, 201, 204):
                    failed += 1
            ok = len(batch) - failed
            inserted += ok
            if failed > 0:
                print(f"  [db] {failed} rows in {table} failed (duplicates/constraints)")
    print(f"[db] Inserted {inserted}/{total} rows into {table}")


# ── Main ────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("Fraud Detection Banking Dashboard — Seed Script")
    print("=" * 60)

    # 1. Check service key
    if not SUPABASE_SERVICE_KEY:
        print("\n⚠  No SUPABASE_SERVICE_KEY set!")
        print("   Export it:  export SUPABASE_SERVICE_KEY='your-key-here'")
        print("   Get it from: Supabase Dashboard → Settings → API → service_role secret\n")

    # 2. Initialize ML scorers
    print("\n[ml] Loading ML models...")
    scorer = FraudScorer()

    # 3. Generate user profiles (before auth, so we have emails/names)
    print("\n[gen] Generating user data...")
    user_data = generate_users()

    # 4. Create Supabase auth users (gets real user IDs)
    print("\n[db] Creating auth users in Supabase...")
    users = create_auth_users(user_data)

    # 5. Generate accounts with real user IDs
    print("\n[gen] Generating accounts...")
    accounts = generate_accounts(users) if users else []

    # 5. Generate transactions from HF dataset (or local PaySim CSV)
    paysim_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_data.csv")

    # Try HF dataset first (or use cached)
    hf_data_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hf_sample.csv")
    if os.path.exists(hf_data_path):
        paysim_path = hf_data_path
        print(f"[db] Using cached HF dataset: {hf_data_path}")
    else:
        hf_dataset_name = "purulalwani/Synthetic-Financial-Datasets-For-Fraud-Detection"
        try:
            from datasets import load_dataset
            print(f"\n[db] Downloading HF dataset: {hf_dataset_name}...")
            ds = load_dataset(hf_dataset_name, split="train", streaming=True)
            count = 0
            rows = []
            for row in ds:
                rows.append(row)
                count += 1
                if count >= 100000:
                    break
            pd.DataFrame(rows).to_csv(hf_data_path, index=False)
            paysim_path = hf_data_path
            print(f"[db] Saved {count} rows from HF dataset to {hf_data_path}")
        except Exception as e:
            if os.path.exists(paysim_path):
                print(f"[db] Using local PaySim CSV: {paysim_path}")
            else:
                print(f"[db] No data source found! Place sample_data.csv in this directory.")
                sys.exit(1)

    # 6. Generate and transform transactions
    print("\n[gen] Generating transactions from PaySim data...")
    transactions = generate_transactions(paysim_path, users, accounts, scorer) if users else []

    # 7. Generate alerts and fraud cases from suspicious transactions
    print("\n[gen] Generating alerts and fraud cases...")
    fraud_txns = [t for t in transactions if t["is_fraud"] or t["risk_level"] in ("high", "critical")]
    alerts = []
    fraud_cases = []
    case_num = 1

    for tx in fraud_txns[:500]:  # cap at 500
        # Alert
        alert_type = random.choice([
            "fraud_detected", "rule_triggered", "anomaly",
            "high_risk", "velocity", "geo_anomaly", "device_mismatch"
        ])
        severity = tx["risk_level"]
        if severity == "critical":
            sev = "critical"
        elif severity == "high":
            sev = "warning"
        else:
            sev = "info"

        alerts.append({
            "alert_type": alert_type,
            "severity": sev,
            "title": f"{alert_type.replace('_', ' ').title()} — ${tx['amount']:,.2f}",
            "message": f"Transaction {tx['transaction_id']} at {tx['merchant']} triggered {alert_type} alert",
            "is_read": random.random() < 0.3,
            "created_at": tx["timestamp"],
        })

        # Fraud case (only for some)
        if tx["is_fraud"] or random.random() < 0.3:
            # Pick an investigator/admin to assign to
            assignee = random.choice([u for u in users if u["role"] in ("investigator", "admin")] or users)
            fraud_cases.append({
                "case_number": f"FC-2024-{case_num:03d}",
                "assigned_to": assignee["id"],
                "assigned_by": assignee["id"],
                "title": f"Fraud Investigation: {tx['merchant']}",
                "description": f"${tx['amount']:,.2f} {tx['transaction_type']} at {tx['merchant']} from {tx['region']}. Risk level: {tx['risk_level']}.",
                "severity": tx["risk_level"],
                "status": random.choice(["open", "open", "open", "investigating", "investigating", "resolved", "dismissed"]),
                "fraud_type": random.choice(["account_takeover", "rapid_cashout", "geo_anomaly", "wire_fraud", "card_not_present", "phishing"]),
                "amount_at_risk": tx["amount"],
                "is_confirmed_fraud": tx["is_fraud"] and random.random() < 0.7,
                "created_at": tx["timestamp"],
            })
            case_num += 1

    # 8. Insert into Supabase
    print("\n[db] Inserting into Supabase...")
    if users:
        supabase_insert("user_profiles", users)
    if accounts:
        supabase_insert("accounts", accounts)
    supabase_insert("transactions", transactions)
    supabase_insert("alerts", alerts)
    supabase_insert("fraud_cases", fraud_cases)

    # 9. Fraud rules are already seeded via SQL schema
    print("\n" + "=" * 60)
    print("✅  Seeding complete!")
    print(f"    • {len(users)} users")
    print(f"    • {len(accounts)} accounts")
    print(f"    • {len(transactions)} transactions")
    print(f"    • {len(alerts)} alerts")
    print(f"    • {len(fraud_cases)} fraud cases")
    print("=" * 60)


if __name__ == "__main__":
    main()
