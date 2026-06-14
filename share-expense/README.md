# ShareExpense — Shared Expense Tracker

A full-stack shared expense tracking application built for flatmates who hate spreadsheets. Handles messy real-world data with intelligent anomaly detection, multi-currency support, and membership-aware balance calculations.

## 🚀 Live Demo

> **Deployed URL**: [Coming Soon — Vercel deployment]

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15 (App Router, TypeScript) |
| **Database** | PostgreSQL (Neon cloud) |
| **ORM** | Prisma 6 |
| **Auth** | NextAuth v5 (Credentials) |
| **UI** | Custom CSS Design System (glassmorphism, dark mode) |
| **Animations** | GSAP, Lenis |
| **CSV Parsing** | Papa Parse + custom anomaly engine |

## 📋 Features

- **Login**: Pre-seeded accounts for all 6 flatmates
- **Groups**: Manage groups with membership timelines (join/leave dates)
- **Expenses**: Full CRUD with 4 split types: equal, unequal, percentage, share
- **CSV Import**: 4-step wizard with 15+ anomaly detection rules
- **Balances**: Real-time balance calculation with debt simplification
- **Settlements**: Record payments with history
- **Multi-currency**: USD → INR conversion (configurable rate)
- **Import Reports**: Every anomaly logged and surfaced

## 🏗 Setup Instructions

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Neon free tier: https://neon.tech)

### 1. Clone & Install

```bash
git clone https://github.com/KAILASH-C12/ShareExpense.git
cd ShareExpense/share-expense
npm install
```

### 2. Configure Database

Create a `.env` file from the template:

```bash
cp .env.example .env
```

Edit `.env` and add your PostgreSQL connection string:

```env
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
AUTH_SECRET="your-secret-key"
```

### 3. Set Up Database

```bash
npx prisma db push     # Create tables
npm run db:seed         # Seed users and group
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — select any user to log in (demo mode, any password works).

### 5. Import CSV Data

1. Go to **Import CSV** in the sidebar
2. Upload `expenses_export.csv` (available in `/public/`)
3. Review detected anomalies
4. Approve/reject changes
5. Confirm import
6. View the import report

## 🏛 Database Schema

See [SCOPE.md](SCOPE.md) for the full schema documentation.

## 📊 Project Structure

```
share-expense/
├── prisma/
│   ├── schema.prisma        # Database schema (8 models)
│   └── seed.ts              # Seed script (users, group, memberships)
├── public/
│   └── expenses_export.csv  # Raw CSV data for import
├── src/
│   ├── app/
│   │   ├── api/             # API routes (REST endpoints)
│   │   │   ├── auth/        # NextAuth handler
│   │   │   ├── balances/    # Balance calculation API
│   │   │   ├── expenses/    # Expenses CRUD
│   │   │   ├── groups/      # Groups CRUD
│   │   │   ├── import/      # CSV import + confirm
│   │   │   ├── settlements/ # Settlement recording
│   │   │   └── users/       # User listing
│   │   ├── balances/        # Balance drill-down page
│   │   ├── dashboard/       # Main dashboard
│   │   ├── expenses/        # Expense list with expandable rows
│   │   ├── groups/          # Group management
│   │   ├── import/          # CSV import wizard (4 steps)
│   │   ├── login/           # Login page
│   │   └── settlements/     # Settlement history + form
│   ├── components/          # Shared UI components
│   └── lib/
│       ├── auth.ts          # NextAuth configuration
│       ├── import-engine.ts # CSV anomaly detection engine
│       └── prisma.ts        # Prisma singleton
├── SCOPE.md                 # Anomaly log + schema
├── DECISIONS.md             # Decision log
└── AI_USAGE.md              # AI tools and corrections
```

## 🤖 AI Tools Used

Built with **Google Gemini (Antigravity IDE)** as the primary AI collaborator. See [AI_USAGE.md](AI_USAGE.md) for details on prompts, errors caught, and corrections made.

## 👤 Author

Built by Kailash C as part of the ShareExpense assignment.
