# FraudShield — Banking Fraud Intelligence Platform

<p>
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Keras-D00000?style=for-the-badge&logo=keras&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
</p>

Enterprise-grade fraud detection dashboard with 26K+ synthetic transactions, real-time monitoring, and ML-powered fraud analysis (Keras + DistilBERT ensemble). Ships role-based workspaces (customer / analyst / investigator / admin / **CEO**), server-side auth routing, hardened Supabase session handling, a Groq-powered AI agent with per-role tool consoles, seeded customer accounts with simulated pipeline activity, a functional realtime notification bell, and a customer-facing transaction history that hides risk data and shows only Completed/Declined outcomes.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Next.js 16     │────▶│  Python ML        │────▶│   Supabase       │
│   (Frontend)     │     │  (FastAPI proxy)  │     │   (DB + Auth)    │
│   localhost:3000 │     │  localhost:5001   │     │   (Cloud)        │
└─────────────────┘     └──────┬───────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  Keras Model     │
                        │  (model.h5)      │
                        │                  │
                        │  DistilBERT      │
                        │  (HF transformer)│
                        └─────────────────┘
```

The frontend fetches data through a same-origin Next.js API route (`/api/proxy`) that forwards requests to the Python ML service. The ML service uses the `service_role` key to query Supabase with no row limits, enabling accurate aggregation across all 26K+ transactions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16.2, React 19, Tailwind CSS v4, TypeScript, recharts, framer-motion, lucide-react |
| Database | Supabase (PostgreSQL) with Row-Level Security |
| Auth | Supabase Auth with SSR (`@supabase/ssr`) + middleware-based route protection |
| ML | Keras model + DistilBERT transformer ensemble via FastAPI sidecar |
| AI Assistant | Groq (LLM) served through a same-origin Next.js API route |

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.9+
- Supabase project (free tier)

### 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL schema (`backend/src/main/resources/supabase-schema.sql`) in the SQL Editor
3. Copy your project URL, anon key, and service role key

### 2. Environment Variables

**`frontend/.env.local`**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_KEY=your-service-role-key
NEXT_PUBLIC_ML_API_URL=http://localhost:5001
GROQ_API_KEY=your-groq-api-key          # optional — powers the AI Agent (or paste a key in the agent panel)
GROQ_MODEL=llama-3.1-8b-instant         # optional
```

### 3. Seed the Database

```bash
cd python-ml-service
pip install -r requirements.txt
export SUPABASE_SERVICE_KEY=your-service-role-key
python3 seed_fast.py
```

This creates 100 users, ~200 accounts, and 25K+ transactions with synthetic fraud patterns.

### 4. Provision Demo Auth Users

Each role needs a sign-in-able Supabase Auth account so the middleware can route users to their workspace:

```bash
cd frontend
npm run seed:auth          # uses SUPABASE_SERVICE_KEY from .env.local
```

The script (`scripts/seed-auth-users.mjs`) creates and keeps in sync:

- **5 staff accounts** — one per role (`user`, `analyst`, `investigator`, `admin`) plus a **CEO** account (`admin@fraudbank.demo`, flagged `is_ceo`).
- **2 customer accounts** — `emma.wilson@fraudbank.demo` and `liam.ross@fraudbank.demo`, each with a "Main Checking" account.
- **Simulated pipeline activity** — 5 transactions + 3 alerts per customer (`SIM-*` IDs) spanning approved (low risk), pending (medium), flagged (high), and blocked (critical) profiles so both the customer history and the staff Detection Flow have realistic data.
- `user_profiles` + JWT metadata kept in sync, with the CEO's `is_ceo` flag enforced server-side.

> Demo credentials (emails + passwords) are tracked in **`accounts.txt`** (repo root), which is git-ignored so secrets never land in version control.

### 5. Run — 2 Terminals

```bash
# Terminal 1 — Python ML service
cd python-ml-service
export SUPABASE_SERVICE_KEY=your-service-role-key
python3 app.py    # → localhost:5001

# Terminal 2 — Next.js frontend
cd frontend
npm run dev        # → localhost:3000
```

Open [localhost:3000](http://localhost:3000).

## Features

### Dashboard
- Real-time transaction monitoring with search and risk/status filters
- KPI cards (26K+ total transactions, suspicious, confirmed fraud, blocked attempts)
- Fraud health cards with animated progress bars
- Live transaction feed with ML risk score bars
- **Detection Flow** — animated pipeline visual that walks flagged/pending transactions through rule-evaluation stages

### Analytics
- Fraud trend area chart (daily incidents + risk score overlay)
- Anomaly detection bar chart
- Geographic distribution pie chart
- Transaction velocity by channel (horizontal bar)
- Device fingerprint donut chart

### Case Management
- Case table with severity badges and status dropdown
- Confirm/dismiss fraud actions
- "New Case" button (admin/investigator only)

### Transaction Detail Drawer
- Full transaction info (amount, type, channel, merchant, status)
- ML fraud probability gauge (animated ring)
- Rule triggers with severity indicators
- Customer/device metadata (IP, device ID, coordinates, region)
- Related-account / device / IP analysis
- Action buttons (block, flag) and fraud-case creation (investigator/admin)

### Transaction History (customer)
- Personal, account-scoped feed merged from `transactions` + `transfers`
- **Privacy-first by design** — no risk scores/levels are shown to customers
- Statuses simplified to **Completed** (approved/completed) or **Declined** (pending/flagged/blocked/failed/declined) only
- Shows **To / From** (merchant for card purchases, counterparty name for transfers), **Transaction ID**, time, amount, and status
- **Click-to-copy transaction IDs** so a customer can share an ID with an analyst/investigator, who can then look it up in the header search bar (`transaction_id` is searchable)

### Transfers (customer)
- Send money between accounts via the `transfer_money` RPC (atomic balance debits/credits + `transfers` row)
- Recipient lookup across users via the `lookup_recipient` RPC
- Completed transfers appear in the customer history; optionally backfilled into the `transactions` pipeline so they're also visible to staff

### Notifications (customer)
- Functional bell in the header backed by the `alerts` table
- Realtime subscription streams new alerts live
- Unread count badge, severity-colored dropdown (info / warning / critical)
- Per-alert read/unread toggle + mark-all-read
- Clicking an alert marks it read and opens the linked transaction drawer

### AI Agent
- Chat panel powered by Groq through a same-origin API route (`/api/groq`)
- Role-aware system prompt; the agent sees live stats, top-risk transactions, open cases, and recent alerts
- Actions surfaced as chips (e.g. "review flagged transactions", "open a case", "block fraudulent ones")
- Streaming cursor UI (`AgentCursor`) while the model responds

### Role Tool Consoles
- **Analyst** — triage queue of highest-risk transactions, lookups, KPI snapshot
- **Investigator** — transaction lookup, case triage, CSV export, action checklist
- **Admin** — platform stats, rule/monitoring status, team oversight
- Each console is gated by the user's role and wired to real Supabase queries

### Reports (analyst/investigator/admin)
- Filterable data-driven export — generate PDF/CSV of cases, alerts, and transactions with one click

### Team Management (admin / CEO)
- Invite and provision users with a role, promote/demote existing members, and search/filter by role
- **CEO elevation** — promote any admin to CEO (or demote) via the crown toggle; only the CEO can create/promote admins or transfer the CEO flag
- Crown badge + "CEO" label shown in sidebars and team tables

### Role-Based Access
| Role | Workspace | Access |
|------|-----------|--------|
| user | `/` | Own account, transaction history, transfer view |
| analyst | `/analyst` | Dashboards, transactions, analytics, cases, reports |
| investigator | `/investigator` | All analyst + update cases, create fraud cases, manage rules |
| admin | `/admin` | Full access + manage rules, team management, exports |
| admin (CEO) | `/admin` | All admin access + promote/demote admins, manage the CEO flag |

RBAC is enforced end-to-end:
- **Next.js middleware** (`src/middleware.ts`) validates the session server-side with `getUser()` and routes each role to its home; unauthenticated users are sent to `/login?next=…`.
- **Supabase RLS policies** restrict writes (e.g., fraud-case and rule updates) to investigator/admin.
- **Frontend `RoleGate` components** gate actions and views per role.
- **Server-side CEO guard** — the `protect_profile_updates` security-definer trigger (with service-role/postgres bypass) enforces the single-CEO invariant and blocks non-CEO admin management, so CEO state can't be forged client-side.

### Realtime
- WebSocket subscriptions via Supabase Realtime
- Live transaction inserts stream to the feed
- New alerts push to the notification bell without a refresh

## Project Structure

```
├── frontend/                    # Next.js application
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/proxy/      # Same-origin proxy to ML service (GET + PATCH)
│   │   │   ├── api/groq/       # Same-origin AI agent route (Groq)
│   │   │   ├── page.tsx         # Customer dashboard (role: user)
│   │   │   ├── analyst/         # Analyst workspace
│   │   │   ├── investigator/    # Investigator workspace
│   │   │   ├── admin/           # Admin workspace
│   │   │   ├── login/           # Login page
│   │   │   └── signup/          # Signup page
│   │   ├── components/
│   │   │   ├── auth/            # RoleGate, ProtectedRoute
│   │   │   ├── workspace/       # Workspace shell + nav for staff roles
│   │   │   ├── ui/              # Sidebar (editable username), Header (bell + search), Icons
│   │   │   ├── dashboard/       # KpiCards, FraudHealthCards, TransactionHistory
│   │   │   ├── transactions/    # TransactionTable, TransactionDrawer
│   │   │   ├── analytics/       # AnalyticsWidgets (recharts charts)
│   │   │   ├── cases/           # CaseManagement
│   │   │   ├── reports/         # ReportsView (PDF/CSV export)
│   │   │   ├── team/            # TeamManagement (admin/CEO)
│   │   │   ├── tools/           # AnalystTools, InvestigatorTools, AdminTools, AiAgent
│   │   │   └── agent/           # AgentCursor (streaming chat cursor)
│   │   ├── context/             # AuthContext, AgentContext
│   │   ├── lib/                 # supabase service, roles, agent, groq, analytics, analyzeTransaction
│   │   ├── middleware.ts         # Server-side auth + role routing
│   │   └── utils/supabase/      # Server + browser client factories
│   └── .env.local
├── backend/
│   └── src/main/resources/
│       └── supabase-schema.sql  # Full DB schema with RLS (+ banking-schema.sql: transfers, transfer_money, lookup_recipient)
├── python-ml-service/
│   ├── app.py                   # FastAPI: /predict, /api/stats, /api/transactions, PATCH status
│   ├── seed_fast.py             # Seed script: 100 users, 25K+ transactions
│   ├── simulate_live.py         # Continuous generator: real-time synthetic transactions
│   ├── backfill_user_data.py    # Idempotent user/account backfill
│   ├── backfill_rule_triggers.py# Idempotent rule-trigger backfill
│   ├── model.h5                 # Keras trained model (PaySim)
│   ├── preprocessor/            # Scaler + LabelEncoder
│   └── requirements.txt
└── README.md
```

## API Endpoints

### Next.js Proxy (same-origin, `localhost:3000`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/proxy?path=stats` | Aggregated dashboard stats (accurate count) |
| GET | `/api/proxy?path=transactions&limit=N` | Transaction list with pagination |
| PATCH | `/api/proxy?path=/api/transactions/{id}` | Update transaction status (investigator/admin) |
| POST | `/api/groq` | AI agent chat (Groq), role-aware context + streaming response |

### ML Sidecar (`localhost:5001`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health check |
| GET | `/api/stats` | Aggregated stats (Postgres-side counts via service_role key) |
| GET | `/api/transactions` | Transaction list (no row limit) |
| PATCH | `/api/transactions/{id}` | Update transaction status |
| POST | `/predict` | Keras fraud prediction (8 features) |
| POST | `/predict-transformer` | DistilBERT text-based fraud prediction |
| POST | `/predict-ensemble` | 60/40 weighted Keras + DistilBERT blend |

## Seed Data

Run `seed_fast.py` to populate the database with realistic synthetic data:

- **100 auth users** with profiles and roles (admin, investigator, analyst, user)
- **~200 accounts** (checking, savings, credit card) with balances
- **25,000+ transactions** with ~5% fraud rate, ML probabilities, risk scores
- **300 alerts** and **100+ fraud cases** assigned to investigators

After seeding, run `npm run seed:auth` in `frontend/` to create sign-in-able Supabase Auth accounts:

- **Staff** — one account per role (`user`, `analyst`, `investigator`, `admin`) plus the **CEO** (`admin@fraudbank.demo`).
- **Customers** — `emma.wilson@fraudbank.demo` and `liam.ross@fraudbank.demo`, each with a checking account and **10 simulated transactions + 6 alerts** (`SIM-*`) exercising approved/pending/flagged/blocked profiles so the Detection Flow and case queue have immediate data.

The script is idempotent: re-running it resets `user_profiles` + JWT metadata, and `simulateTransactions()` deletes and re-creates prior `SIM-*` transactions/alerts before inserting fresh ones.

Demo credentials are listed in **`accounts.txt`** (repo root, git-ignored).

### Transfers & the pipeline

Customer-initiated transfers go through the `transfer_money` RPC and land only in the `transfers` table — they do **not** automatically create `transactions` rows. To surface a real transfer in the Transactions list / Detection Flow / search, either:

- backfill a matching `transactions` row (as done for the demo `TRF-30` $2,222 transfer), or
- extend `transfer_money` so future transfers also insert a pipeline row.

When backfilling, use a `TRF-<id>`-style `transaction_id` (avoid the `SIM-` prefix, which the seed script deletes on re-run).

## Live Simulation

`simulate_live.py` keeps the dashboard alive by generating transactions from the existing accounts, scoring them, and inserting them. Because `transactions` is published to `supabase_realtime`, every insert streams live into the feed.

```bash
cd python-ml-service
python3 simulate_live.py                        # ~500 tx/hour (default)
```

Options:
- `--per-hour N` target throughput (default 500)
- `--once --count N` insert one burst and exit (cron-friendly)
- `--fraud-rate 0.05` fraction of transactions injected as fraud (caught + blocked)
- `--use-ensemble --ml-url http://localhost:5001` score via the running ML service instead of the in-process scorer
- `--no-balances`, `--no-alerts`, `--dry-run`, `--verbose`

For **500 new transactions every hour**, run it as a daemon (streams small batches throughout the hour so the feed animates):

```bash
nohup python3 simulate_live.py --per-hour 500 >> simulate_live.log 2>&1 &
```

or via cron (one burst per hour):

```
0 * * * * cd /path/to/python-ml-service && SUPABASE_SERVICE_KEY=... python3 simulate_live.py --once --count 500 >> simulate_live.log 2>&1
```

> **Note on scoring:** the bundled `model.h5` is trained on an SDV-masked PaySim variant with no learnable fraud signature (evaluation shows ~6% recall, near-zero probabilities), which is why the original seed faked `ml_fraud_probability`. `simulate_live.py` therefore uses an interpretable ML-style scorer (amount, channel, type, merchant-category risk) that reliably flags injected fraud; use `--use-ensemble` once a real model is deployed.
