"""
Redistribute existing transaction/alerts/case timestamps evenly across the
last 30 days so the dashboard trend isn't clustered on one day.

Every row gets its own unique timestamp, spread monotonically across the
span (oldest id -> oldest timestamp), so the live feed shows distinct times
instead of rows sharing one bucket timestamp.

Run once:
  export SUPABASE_SERVICE_KEY=your-service-role-key
  python3 redistribute_timestamps.py
"""
import os, random, time
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

SUPABASE_URL = "https://cllohfvwvhfncgihrnvx.supabase.co"
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

H = {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
     "Content-Type": "application/json"}

SPAN_DAYS = 30
WORKERS = 40

_session = requests.Session()


def fetch_ids(table):
    ids = []
    offset = 0
    while True:
        r = _session.get(f"{SUPABASE_URL}/rest/v1/{table}", headers=H,
                         params={"select": "id", "limit": 1000, "offset": offset, "order": "id.asc"})
        page = r.json()
        if not page:
            break
        ids.extend(t["id"] for t in page)
        offset += 1000
        if len(page) < 1000:
            break
    return ids


def build_timestamps(ids):
    """One unique timestamp per row, spread evenly over the last SPAN_DAYS."""
    n = len(ids)
    now = datetime.now(timezone.utc)
    span = timedelta(days=SPAN_DAYS)
    stamps = []
    for i in range(n):
        ts = now - span + span * (i + 0.5) / max(n, 1)
        ts += timedelta(seconds=random.randint(0, 119),
                        microseconds=random.randint(0, 999999))
        stamps.append(ts.isoformat())
    return stamps


def patch_row(table, field, tid, value):
    url = f"{SUPABASE_URL}/rest/v1/{table}?id=eq.{tid}"
    r = _session.patch(url, headers=H, json={field: value}, timeout=(3, 30))
    return tid, r.status_code


def redistribute(table, field):
    t0 = time.time()
    ids = fetch_ids(table)
    print(f"   {table}: {len(ids)} rows fetched ({time.time()-t0:.1f}s)")
    if not ids:
        return

    stamps = build_timestamps(ids)
    t0 = time.time()
    ok = fails = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        fut = {pool.submit(patch_row, table, field, tid, ts): tid
               for tid, ts in zip(ids, stamps)}
        for f in as_completed(fut):
            tid, code = f.result()
            if code in (200, 204):
                ok += 1
            else:
                fails += 1
                if fails <= 5:
                    print(f"   row {tid}: HTTP {code}")
    print(f"   {table}: {ok} rows updated, {fails} failed ({time.time()-t0:.1f}s)")


def main():
    if not SUPABASE_SERVICE_KEY:
        print("SUPABASE_SERVICE_KEY not set — aborting")
        return

    print(f"Redistributing timestamps over the last {SPAN_DAYS} days...")
    for table, field in [("transactions", "timestamp"),
                         ("alerts", "created_at"),
                         ("fraud_cases", "created_at")]:
        redistribute(table, field)
    print("Done.")


if __name__ == "__main__":
    main()
