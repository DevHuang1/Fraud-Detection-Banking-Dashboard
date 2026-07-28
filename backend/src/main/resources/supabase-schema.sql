-- ============================================================
-- Fraud Detection Banking Dashboard — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. USER PROFILES (extends Supabase Auth users)
create table public.user_profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  role text check (role in ('analyst', 'investigator', 'admin')) default 'analyst',
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_profiles enable row level security;

create policy "Users can read own profile"
  on public.user_profiles for select using (auth.uid() = id);

create policy "Admins can read all profiles"
  on public.user_profiles for select using (
    exists (select 1 from public.user_profiles where id = auth.uid() and role = 'admin')
  );

-- Auto-create profile on signup
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'analyst');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. TRANSACTIONS
create table public.transactions (
  id bigint generated always as identity primary key,
  transaction_id text unique not null,
  account_id text not null,
  account_name text,
  card_last_four text,
  amount decimal(18,2) not null,
  currency text default 'USD',
  merchant text,
  merchant_category text,
  region text,
  city text,
  country text,
  transaction_type text check (transaction_type in ('purchase','transfer','withdrawal','deposit','payment')),
  channel text check (channel in ('online','pos','atm','wire','mobile')),
  timestamp timestamptz not null default now(),
  status text check (status in ('approved','declined','flagged','blocked','pending')) default 'approved',
  risk_score decimal(5,2) default 0.00,
  risk_level text check (risk_level in ('low','medium','high','critical')) default 'low',
  is_fraud boolean default false,
  is_suspicious boolean default false,
  ml_fraud_probability decimal(6,4),
  rule_triggers jsonb default '[]'::jsonb,
  device_id text,
  ip_address text,
  user_agent text,
  latitude decimal(10,7),
  longitude decimal(10,7),
  created_at timestamptz default now()
);

create index idx_transactions_status on public.transactions(status);
create index idx_transactions_risk_level on public.transactions(risk_level);
create index idx_transactions_timestamp on public.transactions(timestamp desc);
create index idx_transactions_account on public.transactions(account_id);

alter table public.transactions enable row level security;
create policy "All auth users can read transactions"
  on public.transactions for select using (auth.role() = 'authenticated');

create policy "Investigators and admins can update transactions"
  on public.transactions for update using (
    exists (select 1 from public.user_profiles where id = auth.uid() and role in ('investigator','admin'))
  );

create policy "Only admins can insert transactions"
  on public.transactions for insert with check (
    exists (select 1 from public.user_profiles where id = auth.uid() and role = 'admin')
  );

create policy "Only admins can delete transactions"
  on public.transactions for delete using (
    exists (select 1 from public.user_profiles where id = auth.uid() and role = 'admin')
  );

-- 3. FRAUD CASES
create table public.fraud_cases (
  id bigint generated always as identity primary key,
  transaction_id bigint references public.transactions(id),
  case_number text unique not null,
  title text,
  description text,
  severity text check (severity in ('low','medium','high','critical')) default 'medium',
  status text check (status in ('open','investigating','resolved','dismissed')) default 'open',
  assigned_to uuid references public.user_profiles(id),
  assigned_by uuid references public.user_profiles(id),
  fraud_type text,
  amount_at_risk decimal(18,2),
  is_confirmed_fraud boolean default false,
  resolution_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_fraud_cases_status on public.fraud_cases(status);
create index idx_fraud_cases_severity on public.fraud_cases(severity);
create index idx_fraud_cases_assigned on public.fraud_cases(assigned_to);

alter table public.fraud_cases enable row level security;
create policy "Authenticated users can read fraud cases"
  on public.fraud_cases for select using (auth.role() = 'authenticated');

create policy "Investigators and admins can update cases"
  on public.fraud_cases for update using (
    exists (select 1 from public.user_profiles where id = auth.uid() and role in ('investigator','admin'))
  );

-- 4. CASE NOTES
create table public.case_notes (
  id bigint generated always as identity primary key,
  case_id bigint references public.fraud_cases(id) on delete cascade,
  author_id uuid references public.user_profiles(id),
  content text not null,
  note_type text check (note_type in ('investigation','resolution','update','comment')),
  created_at timestamptz default now()
);

alter table public.case_notes enable row level security;
create policy "Authenticated users can read case notes"
  on public.case_notes for select using (auth.role() = 'authenticated');

create policy "Users can create case notes"
  on public.case_notes for insert with check (auth.role() = 'authenticated');

-- 5. ALERTS
create table public.alerts (
  id bigint generated always as identity primary key,
  transaction_id bigint references public.transactions(id),
  case_id bigint references public.fraud_cases(id),
  alert_type text check (alert_type in ('fraud_detected','rule_triggered','anomaly','high_risk','velocity','geo_anomaly','device_mismatch')),
  severity text check (severity in ('info','warning','critical')) default 'warning',
  title text not null,
  message text,
  is_read boolean default false,
  created_at timestamptz default now()
);

create index idx_alerts_created on public.alerts(created_at desc);
create index idx_alerts_unread on public.alerts(is_read) where is_read = false;

alter table public.alerts enable row level security;
create policy "All auth users can read alerts"
  on public.alerts for select using (auth.role() = 'authenticated');

create policy "Investigators and admins can update alerts"
  on public.alerts for update using (
    exists (select 1 from public.user_profiles where id = auth.uid() and role in ('investigator','admin'))
  );

create policy "Admins can delete alerts"
  on public.alerts for delete using (
    exists (select 1 from public.user_profiles where id = auth.uid() and role = 'admin')
  );

-- 6. FRAUD RULES
create table public.fraud_rules (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  rule_type text check (rule_type in ('amount','velocity','geo','device','behavioral','custom')),
  conditions jsonb,
  action text check (action in ('flag','block','review','notify')),
  severity text check (severity in ('low','medium','high','critical')) default 'medium',
  is_active boolean default true,
  hit_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.fraud_rules enable row level security;
create policy "All auth users can read fraud rules"
  on public.fraud_rules for select using (auth.role() = 'authenticated');

create policy "Admins can manage fraud rules"
  on public.fraud_rules for insert with check (
    exists (select 1 from public.user_profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update fraud rules"
  on public.fraud_rules for update using (
    exists (select 1 from public.user_profiles where id = auth.uid() and role = 'admin')
  );

-- 7. SEED DATA: Default fraud rules
insert into public.fraud_rules (name, description, rule_type, action, severity) values
  ('High-Value Threshold',  'Transactions exceeding $10,000', 'amount', 'flag', 'high'),
  ('Velocity Spike',        'More than 5 transactions in 10 minutes', 'velocity', 'block', 'critical'),
  ('Geo Anomaly',           'Transaction from unusual geographic location', 'geo', 'flag', 'high'),
  ('Device Mismatch',       'Transaction from unrecognized device', 'device', 'review', 'medium'),
  ('Night Trading',         'High-value transaction during off-hours (12AM-5AM)', 'behavioral', 'flag', 'medium'),
  ('Rapid Cash-Out',        'Multiple ATM withdrawals in short period', 'velocity', 'block', 'critical'),
  ('New Account Risk',      'Account less than 30 days old with large transaction', 'behavioral', 'flag', 'high'),
  ('International Alert',  'Cross-border transaction to high-risk region', 'geo', 'notify', 'medium');

-- Enable Realtime for live updates
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.alerts;
alter publication supabase_realtime add table public.fraud_cases;
