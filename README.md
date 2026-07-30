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

Enterprise-grade fraud detection dashboard with 26K+ synthetic transactions, real-time monitoring, and ML-powered fraud analysis (Keras + DistilBERT ensemble).

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
| Auth | Supabase Auth with SSR (`@supabase/ssr`) |
| ML | Keras model + DistilBERT transformer ensemble via FastAPI sidecar |

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
```

### 3. Seed the Database

```bash
cd python-ml-service
pip install -r requirements.txt
export SUPABASE_SERVICE_KEY=your-service-role-key
python3 seed_fast.py
```

This creates 100 users, ~200 accounts, and 25K+ transactions with synthetic fraud patterns.

### 4. Run — 2 Terminals

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
- Action buttons (block, flag, more)

### Role-Based Access
| Role | Access |
|------|--------|
| Analyst | View dashboards, transactions, cases, analytics |
| Investigator | All analyst + update cases, manage rules |
| Admin | Full access + manage rules, team, delete data |

RBAC is enforced via Supabase RLS policies and frontend `RoleGate` components.

### Realtime
- WebSocket subscriptions via Supabase Realtime
- Live transaction inserts stream to the feed

## Project Structure

```
├── frontend/                    # Next.js application
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/proxy/      # Same-origin proxy to ML service
│   │   │   ├── page.tsx         # Main dashboard
│   │   │   ├── login/           # Login page
│   │   │   └── signup/          # Signup page
│   │   ├── components/
│   │   │   ├── auth/            # RoleGate, ProtectedRoute
│   │   │   ├── ui/              # Sidebar, Header, Icons
│   │   │   ├── dashboard/       # KpiCards, FraudHealthCards
│   │   │   ├── transactions/    # TransactionTable, TransactionDrawer
│   │   │   ├── analytics/       # AnalyticsWidgets (5 recharts charts)
│   │   │   └── cases/           # CaseManagement
│   │   ├── context/             # AuthContext (Supabase SSR)
│   │   ├── lib/                 # Supabase service + type exports
│   │   └── utils/supabase/      # Server + browser client factories
│   └── .env.local
├── backend/
│   └── src/main/resources/
│       └── supabase-schema.sql  # Full DB schema with RLS
├── python-ml-service/
│   ├── app.py                   # FastAPI: /predict, /api/stats, /api/transactions
│   ├── seed_fast.py             # Seed script: 100 users, 25K+ transactions
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

### ML Sidecar (`localhost:5001`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health check |
| GET | `/api/stats` | Aggregated stats (via service_role key) |
| GET | `/api/transactions` | Transaction list (no row limit) |
| POST | `/predict` | Keras fraud prediction (8 features) |
| POST | `/predict-transformer` | DistilBERT text-based fraud prediction |
| POST | `/predict-ensemble` | 60/40 weighted Keras + DistilBERT blend |

## Seed Data

Run `seed_fast.py` to populate the database with realistic synthetic data:

- **100 auth users** with profiles and roles (admin, investigator, analyst, user)
- **~200 accounts** (checking, savings, credit card) with balances
- **25,000+ transactions** with ~5% fraud rate, ML probabilities, risk scores
- **300 alerts** and **100+ fraud cases** assigned to investigators
