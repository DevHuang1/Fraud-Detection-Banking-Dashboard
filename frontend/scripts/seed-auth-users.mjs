// Seeds demo Supabase Auth users (one per role) so the role-based workspaces
// can be tested end-to-end. Profiles + default accounts are auto-created by the
// handle_new_user trigger. Idempotent — safe to run repeatedly.
//
// Also creates two customer accounts and simulates transactions for them so
// they show up in the transaction list and Detection Flow pipeline.
//
// Usage (from frontend/):  node --env-file=.env.local scripts/seed-auth-users.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "Demo@1234";

const STAFF_USERS = [
  { email: "demo.user@banking.demo", full_name: "Alex Morgan", role: "user" },
  { email: "demo.analyst@banking.demo", full_name: "Sam Carter", role: "analyst" },
  { email: "demo.investigator@banking.demo", full_name: "Riley Hayes", role: "investigator" },
  { email: "demo.admin@banking.demo", full_name: "Jordan Lee", role: "admin", is_ceo: false },
  // Single CEO account: unrestricted, can manage other admins.
  { email: "admin@fraudbank.demo", full_name: "Ava Sterling", role: "admin", is_ceo: true, password: "FraudWatch2026!" },
];

// Two customer accounts used for transaction simulation / pipeline demo.
const CUSTOMER_USERS = [
  { email: "emma.wilson@fraudbank.demo", full_name: "Emma Wilson", role: "user", password: "FraudWatch2026!" },
  { email: "liam.ross@fraudbank.demo", full_name: "Liam Ross", role: "user", password: "FraudWatch2026!" },
];

// Simulated transactions per customer. profile drives the risk output so the
// Detection Flow has a good mix: approved/low, pending/medium, flagged/high,
// blocked/critical.
const SIM_SCENARIOS = {
  "emma.wilson@fraudbank.demo": [
    { merchant: "Starbucks", category: "coffee shops", amount: 8.75, region: "North America", city: "New York", country: "US", channel: "pos", type: "purchase", profile: "approved" },
    { merchant: "Amazon", category: "online retail", amount: 142.5, region: "North America", city: "Austin", country: "US", channel: "online", type: "purchase", profile: "approved" },
    { merchant: "P2P Pay", category: "person-to-person", amount: 650, region: "North America", city: "Chicago", country: "US", channel: "mobile", type: "transfer", profile: "pending" },
    { merchant: "Western Union", category: "money transfer", amount: 4800, region: "Africa", city: "Lagos", country: "NG", channel: "wire", type: "transfer", profile: "flagged" },
    { merchant: "CryptoPrime Exchange", category: "cryptocurrency", amount: 12750, region: "Europe", city: "Tallinn", country: "EE", channel: "online", type: "purchase", profile: "blocked" },
  ],
  "liam.ross@fraudbank.demo": [
    { merchant: "Costco", category: "wholesale", amount: 236.4, region: "North America", city: "Seattle", country: "US", channel: "pos", type: "purchase", profile: "approved" },
    { merchant: "Shell", category: "gas stations", amount: 62, region: "North America", city: "Portland", country: "US", channel: "pos", type: "purchase", profile: "approved" },
    { merchant: "CityBank ATM", category: "atm", amount: 1200, region: "Europe", city: "Berlin", country: "DE", channel: "atm", type: "withdrawal", profile: "pending" },
    { merchant: "Tiffany & Co.", category: "jewelry", amount: 9300, region: "Middle East", city: "Dubai", country: "AE", channel: "pos", type: "purchase", profile: "flagged" },
    { merchant: "SwiftBank Wire", category: "money transfer", amount: 28000, region: "Asia", city: "Hong Kong", country: "HK", channel: "wire", type: "transfer", profile: "blocked" },
  ],
};

function riskFields(profile) {
  let ml;
  switch (profile) {
    case "approved": ml = 0.05 + Math.random() * 0.18; break;
    case "pending": ml = 0.35 + Math.random() * 0.2; break;
    case "flagged": ml = 0.62 + Math.random() * 0.15; break;
    case "blocked": ml = 0.86 + Math.random() * 0.1; break;
    default: ml = 0.1;
  }
  const riskLevel = ml >= 0.85 ? "critical" : ml >= 0.6 ? "high" : ml >= 0.3 ? "medium" : "low";
  const status = profile === "blocked" ? "blocked" : profile === "flagged" ? "flagged" : profile === "pending" ? "pending" : "approved";
  return {
    ml: Number(ml.toFixed(4)),
    riskScore: Math.round(ml * 100),
    riskLevel,
    status,
    isFraud: profile === "blocked",
    isSuspicious: profile !== "approved",
  };
}

function rulesFor(sc, profile) {
  const rules = [];
  if (sc.amount > 10000) rules.push({ rule: "Large amount (>$10k)", severity: "critical" });
  else if (sc.amount > 2500) rules.push({ rule: "High-value transaction", severity: "high" });
  if (["cryptocurrency", "money transfer", "jewelry"].includes(sc.category)) {
    rules.push({ rule: `High-risk category: ${sc.category}`, severity: "high" });
  }
  if (!["US", "CA"].includes(sc.country)) rules.push({ rule: `Unusual region: ${sc.region}`, severity: "high" });
  if (sc.channel === "wire") rules.push({ rule: "Wire transfer channel", severity: "medium" });
  if (sc.channel === "atm") rules.push({ rule: "ATM withdrawal abroad", severity: "medium" });
  if (profile === "blocked") rules.push({ rule: "Velocity spike: 5+ txns in 10 min", severity: "critical" });
  if (profile === "pending") rules.push({ rule: "New device sign-in", severity: "medium" });
  return rules;
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36";

async function main() {
  const { data: page, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) {
    console.error("Failed to list users:", listError.message);
    process.exit(1);
  }
  const byEmail = new Map((page?.users || []).map((u) => [u.email.toLowerCase(), u]));

  const ensureUser = async (demo) => {
    const existing = byEmail.get(demo.email.toLowerCase());
    if (existing) {
      const merged = { ...(existing.user_metadata || {}), full_name: demo.full_name, role: demo.role };
      const { error } = await supabase.auth.admin.updateUserById(existing.id, {
        user_metadata: merged,
        app_metadata: { ...(existing.app_metadata || {}), role: demo.role },
      });
      console.log(error ? `[warn] ${demo.email}: ${error.message}` : `[ok] ${demo.email} -> role updated to '${demo.role}'`);
      if (!error) await syncProfile(existing.id, demo);
      return existing.id;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: demo.email,
      password: demo.password || PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: demo.full_name, role: demo.role },
      app_metadata: { role: demo.role },
    });
    if (error) {
      console.error(`[fail] ${demo.email}: ${error.message}`);
      return null;
    }
    console.log(`[ok] ${demo.email} created (id: ${data.user.id}), role '${demo.role}'`);
    await syncProfile(data.user.id, demo);
    return data.user.id;
  };

  for (const demo of STAFF_USERS) await ensureUser(demo);

  for (const cust of CUSTOMER_USERS) {
    const id = await ensureUser(cust);
    if (id) cust.id = id;
  }

  await simulateTransactions();
  console.log("\nDemo sign-in credentials (password for all): " + PASSWORD);
  console.log("CEO account (admin@fraudbank.demo) password: FraudWatch2026!");
}

// Keep user_profiles in sync (role + is_ceo). handle_new_user only runs on
// first insert, so existing users need an explicit profile update.
async function syncProfile(userId, demo) {
  const { error } = await supabase
    .from("user_profiles")
    .update({ role: demo.role, is_ceo: demo.is_ceo || false, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) {
    console.log(`[warn] ${demo.email}: profile sync failed: ${error.message}`);
  }
}

// Insert SIM-* transactions + alerts for each customer account. Deletes any
// previous SIM-* rows first so it stays idempotent.
async function simulateTransactions() {
  let inserted = 0;
  for (const cust of CUSTOMER_USERS) {
    if (!cust.id) continue;
    const { data: accts } = await supabase.from("accounts").select("*").eq("user_id", cust.id);
    if (!accts || accts.length === 0) {
      console.log(`[warn] ${cust.email}: no account found, skipping simulation`);
      continue;
    }
    const acct = accts[0];

    const { data: oldTx } = await supabase
      .from("transactions")
      .select("id")
      .eq("account_id", acct.account_number)
      .like("transaction_id", "SIM-%");
    if (oldTx && oldTx.length) {
      const ids = oldTx.map((r) => r.id);
      await supabase.from("alerts").delete().in("transaction_id", ids);
      await supabase.from("transactions").delete().in("id", ids);
    }

    const scenarios = SIM_SCENARIOS[cust.email] || [];
    const rows = scenarios.map((sc, i) => {
      const r = riskFields(sc.profile);
      const stamp = new Date(Date.now() - i * 90000).toISOString();
      return {
        transaction_id: `SIM-${acct.account_number.replace("ACC-", "")}-${Date.now().toString().slice(-6)}${i}`,
        account_id: acct.account_number,
        account_name: acct.account_name,
        card_last_four: String(Math.floor(1000 + Math.random() * 9000)),
        amount: sc.amount,
        currency: "USD",
        merchant: sc.merchant,
        merchant_category: sc.category,
        region: sc.region,
        city: sc.city,
        country: sc.country,
        transaction_type: sc.type,
        channel: sc.channel,
        timestamp: stamp,
        status: r.status,
        risk_score: r.riskScore,
        risk_level: r.riskLevel,
        is_fraud: r.isFraud,
        is_suspicious: r.isSuspicious,
        ml_fraud_probability: r.ml,
        rule_triggers: rulesFor(sc, sc.profile),
        device_id: `DEV-${Math.random().toString(16).slice(2, 10)}`,
        ip_address: `${Math.floor(Math.random() * 200 + 20)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        user_agent: UA,
        latitude: Number((Math.random() * 180 - 90).toFixed(6)),
        longitude: Number((Math.random() * 360 - 180).toFixed(6)),
      };
    });

    const { data: txRows, error: txErr } = await supabase.from("transactions").insert(rows).select("id,transaction_id,status,risk_level");
    if (txErr) {
      console.log(`[warn] ${cust.email}: transaction insert failed: ${txErr.message}`);
      continue;
    }
    inserted += txRows.length;
    console.log(`[ok] ${cust.email}: ${txRows.length} simulated transactions`);

    const alerts = txRows
      .map((tx, i) => {
        const sc = scenarios[i];
        if (sc.profile === "approved") return null;
        return {
          transaction_id: tx.id,
          alert_type: sc.profile === "blocked" ? "fraud_detected" : sc.profile === "flagged" ? "high_risk" : "anomaly",
          severity: sc.profile === "blocked" ? "critical" : sc.profile === "flagged" ? "warning" : "info",
          title: sc.profile === "blocked" ? "Transaction blocked — possible fraud" : sc.profile === "flagged" ? "High-risk transaction flagged" : "Anomaly flagged for review",
          message: `${sc.merchant} · $${sc.amount.toLocaleString()} · ${sc.city}, ${sc.country} · ${sc.channel}`,
          is_read: false,
        };
      })
      .filter(Boolean);

    if (alerts.length > 0) {
      const { error: alErr } = await supabase.from("alerts").insert(alerts);
      if (alErr) console.log(`[warn] ${cust.email}: alert insert failed: ${alErr.message}`);
      else console.log(`[ok] ${cust.email}: ${alerts.length} alerts created`);
    }
  }
  if (inserted > 0) console.log(`\n[sim] ${inserted} transactions inserted — open Detection Flow to watch them run through the pipeline.`);
}

main();
