// Seeds demo Supabase Auth users (one per role) so the role-based workspaces
// can be tested end-to-end. Profiles + default accounts are auto-created by the
// handle_new_user trigger. Idempotent — safe to run repeatedly.
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

const DEMO_USERS = [
  { email: "demo.user@banking.demo", full_name: "Alex Morgan", role: "user" },
  { email: "demo.analyst@banking.demo", full_name: "Sam Carter", role: "analyst" },
  { email: "demo.investigator@banking.demo", full_name: "Riley Hayes", role: "investigator" },
  { email: "demo.admin@banking.demo", full_name: "Jordan Lee", role: "admin" },
];

async function main() {
  const { data: page, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) {
    console.error("Failed to list users:", listError.message);
    process.exit(1);
  }
  const byEmail = new Map((page?.users || []).map((u) => [u.email.toLowerCase(), u]));

  for (const demo of DEMO_USERS) {
    const existing = byEmail.get(demo.email.toLowerCase());

    if (existing) {
      const merged = { ...(existing.user_metadata || {}), full_name: demo.full_name, role: demo.role };
      const { error } = await supabase.auth.admin.updateUserById(existing.id, {
        user_metadata: merged,
        app_metadata: { ...(existing.app_metadata || {}), role: demo.role },
      });
      console.log(error ? `[warn] ${demo.email}: ${error.message}` : `[ok] ${demo.email} -> role updated to '${demo.role}'`);
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: demo.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: demo.full_name, role: demo.role },
      app_metadata: { role: demo.role },
    });
    if (error) {
      console.error(`[fail] ${demo.email}: ${error.message}`);
      continue;
    }
    console.log(`[ok] ${demo.email} created (id: ${data.user.id}), role '${demo.role}'`);
  }

  console.log("\nDemo sign-in credentials (password for all): " + PASSWORD);
}

main();
