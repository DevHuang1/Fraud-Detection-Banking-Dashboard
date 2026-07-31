"""
Redistribute existing transaction/alerts/case timestamps evenly across the
last 30 days so the dashboard trend isn't clustered on one day.

Fast path: fetches all ids, buckets them into ~2-hour timestamp groups, and
issues ONE bulk PATCH per group (id=in.(...)), instead of one request per row.

Run once:
  export SUPABASE_SERVICE_KEY=your-service-role-key
  python3 redistribute_timestamps.py
"""
import os, random, time
from datetime import datetime, timedelta, timezone
import requests

SUPABASE_URL = "https://cllohfvwvhfncgihrnvx.supabase.co"
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

H = {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
     "Content-Type": "application/json"}

SPAN_DAYS = 30
BUCKETS_PER_DAY = 12  # one timestamp bucket every ~2 hours

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


def build_buckets(ids):
    """Group ids into timestamp buckets spread over the last SPAN_DAYS days."""
    n = len(ids)
    total_buckets = SPAN_DAYS * BUCKETS_PER_DAY
    now = datetime.now(timezone.utc)
    span = timedelta(days=SPAN_DAYS)
    chunks: dict[int, list] = {}
    chunk_ts: dict[int, str] = {}
    for i, tid in enumerate(ids):
        b = int(i * total_buckets / max(n, 1))
        if b not in chunks:
            day_frac = b / total_buckets
            ts = now - span + span * day_frac
            ts += timedelta(minutes=random.randint(0, 119))
            chunk_ts[b] = ts.isoformat()
            chunks[b] = []
        chunks[b].append(tid)
    return chunks, chunk_ts


def patch_group(table, field, ids, value):
    url = f"{SUPABASE_URL}/rest/v1/{table}?id=in.({','.join(map(str, ids))})"
    return _session.patch(url, headers=H, json={field: value}).status_code


def redistribute(table, field):
    t0 = time.time()
    ids = fetch_ids(table)
    print(f"   {table}: {len(ids)} rows fetched ({time.time()-t0:.1f}s)")
    if not ids:
        return

    chunks, chunk_ts = build_buckets(ids)
    t0 = time.time()
    ok = fails = 0
    for b in sorted(chunks):
        code = patch_group(table, field, chunks[b], chunk_ts[b])
        if code in (200, 204):
            ok += 1
        else:
            fails += 1
            print(f"   bucket {b}: HTTP {code}")
    print(f"   {table}: {ok} buckets updated, {fails} failed ({time.time()-t0:.1f}s)")


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
