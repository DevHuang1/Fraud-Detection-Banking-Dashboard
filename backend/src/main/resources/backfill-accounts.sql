-- ============================================================
-- Backfill: creates user_profiles + accounts for ALL auth users
-- Run this in your Supabase SQL Editor after banking-schema.sql
-- Idempotent — safe to run multiple times
-- ============================================================

do $$
declare
  r record;
begin
  for r in
    select au.id, au.email, au.raw_user_meta_data->>'role' as role
    from auth.users au
    where not exists (
      select 1 from public.accounts a where a.user_id = au.id
    )
  loop
    -- Ensure user_profiles entry exists
    insert into public.user_profiles (id, email, full_name, role)
    values (
      r.id,
      r.email,
      r.email,
      coalesce(r.role, 'user')
    )
    on conflict (id) do update
      set email = excluded.email,
          role = coalesce(excluded.role, user_profiles.role);

    -- Main Checking with $10k
    insert into public.accounts (user_id, account_name, balance, currency)
    values (r.id, 'Main Checking', 10000.00, 'USD');

    -- Blank accounts
    insert into public.accounts (user_id, account_name, balance, currency)
    values (r.id, 'Savings', 0.00, 'USD');
    insert into public.accounts (user_id, account_name, balance, currency)
    values (r.id, 'Travel Card', 0.00, 'USD');
    insert into public.accounts (user_id, account_name, balance, currency)
    values (r.id, 'Investment', 0.00, 'USD');
  end loop;
end;
$$;
