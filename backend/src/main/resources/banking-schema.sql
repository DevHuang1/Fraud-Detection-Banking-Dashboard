-- ============================================================
-- Banking Schema — Accounts, Transfers, Atomic Transfer RPC
-- Run this in your Supabase SQL Editor
-- Idempotent — safe to run multiple times
-- ============================================================

-- 1. ACCOUNTS
create table if not exists public.accounts (
  id bigint generated always as identity primary key,
  user_id uuid references public.user_profiles(id) on delete cascade not null,
  account_name text not null,
  account_number text unique not null default 'ACC-' || floor(random() * 90000 + 10000)::text,
  balance decimal(18,2) default 0.00,
  currency text default 'USD',
  created_at timestamptz default now()
);

create index if not exists idx_accounts_user on public.accounts(user_id);

alter table public.accounts enable row level security;

do $$ begin
  create policy "Users can read own accounts" on public.accounts
    for select using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can update own accounts" on public.accounts
    for update using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

-- 2. TRANSFERS
create table if not exists public.transfers (
  id bigint generated always as identity primary key,
  sender_account_id bigint references public.accounts(id) not null,
  receiver_account_id bigint references public.accounts(id) not null,
  sender_name text,
  receiver_name text,
  amount decimal(18,2) not null,
  note text,
  status text check (status in ('completed','pending','failed')) default 'completed',
  created_at timestamptz default now()
);

create index if not exists idx_transfers_sender on public.transfers(sender_account_id);
create index if not exists idx_transfers_receiver on public.transfers(receiver_account_id);

alter table public.transfers enable row level security;

do $$ begin
  create policy "Users can read transfers involving their accounts" on public.transfers
    for select using (
      exists (select 1 from public.accounts where id = sender_account_id and user_id = auth.uid())
      or exists (select 1 from public.accounts where id = receiver_account_id and user_id = auth.uid())
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can insert transfers from their accounts" on public.transfers
    for insert with check (
      exists (select 1 from public.accounts where id = sender_account_id and user_id = auth.uid())
    );
exception when duplicate_object then null;
end $$;

-- 3. ATOMIC TRANSFER FUNCTION
create or replace function public.transfer_money(
  sender_acc_id bigint,
  receiver_acc_id bigint,
  transfer_amount decimal,
  transfer_note text default ''
)
returns jsonb
language plpgsql
security definer
as $$
declare
  sender_bal decimal;
  receiver_exists boolean;
  sender_name text;
  receiver_name text;
begin
  select balance, account_name into sender_bal, sender_name
  from public.accounts where id = sender_acc_id
  for update;

  if sender_bal is null then
    return jsonb_build_object('success', false, 'error', 'Sender account not found');
  end if;

  select exists(select 1 from public.accounts where id = receiver_acc_id), account_name
  into receiver_exists, receiver_name
  from public.accounts where id = receiver_acc_id;

  if not receiver_exists then
    return jsonb_build_object('success', false, 'error', 'Receiver account not found');
  end if;

  if sender_bal < transfer_amount then
    return jsonb_build_object('success', false, 'error', 'Insufficient balance');
  end if;

  update public.accounts set balance = balance - transfer_amount where id = sender_acc_id;
  update public.accounts set balance = balance + transfer_amount where id = receiver_acc_id;

  insert into public.transfers (sender_account_id, receiver_account_id, sender_name, receiver_name, amount, note)
  values (sender_acc_id, receiver_acc_id, sender_name, receiver_name, transfer_amount, transfer_note);

  return jsonb_build_object('success', true, 'error', null);
end;
$$;

-- 4. RECIPIENT LOOKUP (bypasses RLS for cross-user lookups)
create or replace function public.lookup_recipient(search_query text)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  if search_query like '%@%' then
    select jsonb_build_object(
      'id', a.id,
      'account_name', a.account_name,
      'account_number', a.account_number,
      'email', up.email
    ) into result
    from public.accounts a
    join public.user_profiles up on up.id = a.user_id
    where up.email = lower(search_query)
    limit 1;
  else
    select jsonb_build_object(
      'id', a.id,
      'account_name', a.account_name,
      'account_number', a.account_number,
      'email', up.email
    ) into result
    from public.accounts a
    join public.user_profiles up on up.id = a.user_id
    where a.account_number = case
      when search_query ~ '^\d+$' then 'ACC-' || search_query
      else search_query
    end
    limit 1;
  end if;

  if result is null then
    return jsonb_build_object('success', false, 'error', 'Recipient not found');
  end if;

  return jsonb_build_object('success', true, 'data', result);
end;
$$;

-- 5. UPDATE AUTO-CREATE TRIGGER to also create default checking account
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'user')
  );
  insert into public.accounts (user_id, account_name, balance)
  values (new.id, 'Main Checking', 10000.00)
  on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
