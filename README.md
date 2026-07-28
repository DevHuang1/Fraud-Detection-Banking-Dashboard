# FraudShield — Banking Fraud Intelligence Platform

Enterprise-grade fraud detection dashboard built with Next.js, Spring Boot, and Supabase, powered by the CiferAI ML model (99.93% accuracy).

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Next.js 16     │────▶│  Spring Boot 4    │────▶│   Supabase       │
│   (Frontend)     │     │  (Backend API)    │     │   (DB + Auth)    │
│   localhost:3000 │     │  localhost:8080   │     │   (Cloud)        │
└─────────────────┘     └──────┬───────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  Python ML       │
                        │  Sidecar         │
                        │  localhost:5001  │
                        │  (CiferAI)       │
                        └─────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16.2, React 19, Tailwind CSS v4, TypeScript, recharts, framer-motion, lucide-react |
| Backend | Spring Boot 4.0, Java 21, Spring Security |
| Database | Supabase (PostgreSQL) with Row-Level Security |
| Auth | Supabase Auth with SSR (`@supabase/ssr`) |
| ML | CiferAI Keras model via FastAPI sidecar |

## Getting Started

### Prerequisites

- Node.js 20+
- Java 21+
- Python 3.9+
- Supabase project (free tier)

### 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run `backend/src/main/resources/supabase-schema.sql` in the SQL Editor
3. Copy your project URL, anon key, and service role key

### 2. Environment Variables

**`frontend/.env.local`**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

**`backend/src/main/resources/application.properties`**
```properties
supabase.url=https://your-project.supabase.co
supabase.anon-key=your-anon-key
supabase.service-role-key=your-service-role-key
supabase.jwt-secret=your-jwt-secret
```

### 3. Run — 3 Terminals

```bash
# Terminal 1 — Python ML sidecar
cd python-ml-service
pip install -r requirements.txt
uvicorn app:app --port 5001

# Terminal 2 — Spring Boot backend
cd backend
./mvnw spring-boot:run

# Terminal 3 — Next.js frontend
cd frontend
npm run dev
```

Open [localhost:3000](http://localhost:3000).

## Features

### Dashboard
- Real-time transaction monitoring with search and risk/status filters
- KPI cards (total transactions, suspicious, confirmed fraud, blocked attempts)
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

RBAC is enforced via:
- **Database**: Supabase RLS policies per table
- **Backend**: Role checks on sensitive endpoints (`/cases`, `/rules`)
- **Frontend**: `ProtectedRoute` (auth gate), `RoleGate` (component wrapper), sidebar filtering

### Realtime
- WebSocket subscriptions via Supabase Realtime
- Live transaction inserts stream to the feed

## Project Structure

```
├── frontend/                    # Next.js application
│   ├── src/
│   │   ├── app/                 # Pages (dashboard, login, signup)
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
├── backend/                     # Spring Boot API
│   ├── src/main/java/com/bank/frauddetection/
│   │   ├── controller/          # AuthController, DashboardController
│   │   ├── supabase/            # SupabaseClient, AuthService, DataService
│   │   ├── dto/                 # FraudDetectionRequest/Response
│   │   ├── ml/                  # FraudDetectionClient (ML sidecar)
│   │   └── config/              # RestTemplateConfig
│   └── src/main/resources/
│       └── supabase-schema.sql  # Full DB schema with RLS
├── python-ml-service/           # FastAPI ML sidecar
│   ├── app.py                   # /predict and /health endpoints
│   ├── model.h5                 # CiferAI trained model
│   ├── preprocessor.joblib      # Scaler + LabelEncoder
│   └── requirements.txt
└── README.md
```

## API Endpoints

### Backend (`/api`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | No | Login with email/password |
| GET | `/auth/me` | Yes | Current user profile + role |
| GET | `/auth/role` | Yes | Current user role |
| GET | `/dashboard/stats` | Yes | Aggregated dashboard stats |
| GET | `/dashboard/transactions` | Yes | Transaction list |
| GET | `/dashboard/transactions/{id}` | Yes | Single transaction detail |
| GET | `/dashboard/cases` | Yes | Fraud cases list |
| PATCH | `/dashboard/cases/{id}` | Inv/Admin | Update case |
| GET | `/dashboard/alerts` | Yes | Alerts list |
| GET | `/dashboard/rules` | Yes | Fraud rules list |

### ML Sidecar (`localhost:5001`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/predict` | Predict fraud probability (8 features) |
| GET | `/health` | Service health check |
