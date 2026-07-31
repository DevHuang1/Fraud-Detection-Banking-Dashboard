"""
Create aggregate stats RPC in Supabase to bypass the 1000-row limit.
"""
import os
import requests

SUPABASE_URL = "https://cllohfvwvhfncgihrnvx.supabase.co"
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

H = {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
     "Content-Type": "application/json"}

sql = """
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'totalTransactions', COUNT(*),
        'suspiciousTransactions', COUNT(*) FILTER (WHERE is_suspicious = true),
        'confirmedFraud', COUNT(*) FILTER (WHERE is_fraud = true),
        'blockedAttempts', COUNT(*) FILTER (WHERE status = 'blocked'),
        'avgRiskScore', COALESCE(ROUND(AVG(risk_score)::numeric, 2), 0),
        'highRiskAccounts', COUNT(*) FILTER (WHERE risk_level IN ('high', 'critical')),
        'fraudRate', CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE is_fraud = true)::numeric / COUNT(*)) * 100, 2) ELSE 0 END,
        'unreadAlerts', (SELECT COUNT(*) FROM alerts WHERE is_read = false)
    )
    FROM transactions
    INTO result;
    RETURN result;
END;
$$;
"""
r = requests.post(f"{SUPABASE_URL}/rest/v1/rpc/", params={"query": sql}, headers=H)
print(f"RPC result: {r.status_code}")
if r.status_code != 200:
    print(r.text[:300])
