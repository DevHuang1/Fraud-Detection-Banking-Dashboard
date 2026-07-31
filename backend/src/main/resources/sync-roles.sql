-- ============================================================
-- Sync user_profiles.role from auth.users.raw_user_meta_data
-- Run this after backfill-accounts.sql if the displayed role
-- differs from what you selected at signup.
-- Idempotent — safe to re-run
-- ============================================================

update public.user_profiles up
set role = au.raw_user_meta_data->>'role'
from auth.users au
where au.id = up.id
  and au.raw_user_meta_data->>'role' is not null
  and au.raw_user_meta_data->>'role' in ('user', 'analyst', 'investigator', 'admin')
  and up.role != au.raw_user_meta_data->>'role';
