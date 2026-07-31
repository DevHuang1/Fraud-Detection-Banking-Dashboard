-- ============================================================
-- Seed additional blank accounts ($0) for existing users
-- Run this in your Supabase SQL Editor after banking-schema.sql
-- Idempotent — safe to run multiple times
-- ============================================================

do $$
declare
  r record;
begin
  for r in
    select distinct a.user_id
    from public.accounts a
    where a.account_name = 'Main Checking'
  loop
    -- Savings
    if not exists (
      select 1 from public.accounts
      where user_id = r.user_id and account_name = 'Savings'
    ) then
      insert into public.accounts (user_id, account_name, balance, currency)
      values (r.user_id, 'Savings', 0.00, 'USD');
    end if;

    -- Travel Card
    if not exists (
      select 1 from public.accounts
      where user_id = r.user_id and account_name = 'Travel Card'
    ) then
      insert into public.accounts (user_id, account_name, balance, currency)
      values (r.user_id, 'Travel Card', 0.00, 'USD');
    end if;

    -- Investment
    if not exists (
      select 1 from public.accounts
      where user_id = r.user_id and account_name = 'Investment'
    ) then
      insert into public.accounts (user_id, account_name, balance, currency)
      values (r.user_id, 'Investment', 0.00, 'USD');
    end if;
  end loop;
end;
$$;
