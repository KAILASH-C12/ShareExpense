# DECISIONS.md — Key Architecture & Product Decisions

Here are the most significant decisions made to address the flatmates' constraints, the options considered, and the final rationale:

### 1. Framework & Database
- **Decision**: Next.js 15 (App Router) + Neon PostgreSQL.
- **Options**: React+Express vs. Full-stack Next.js; Local SQLite vs. Hosted Postgres.
- **Why**: Next.js provides a unified full-stack environment perfect for quick deployment. Neon Postgres satisfies the relational DB requirement and offers free, serverless hosting.

### 2. Authentication
- **Decision**: NextAuth Credentials with a "Demo Mode".
- **Options**: Full OAuth vs. Standard Email/Password vs. Demo mode.
- **Why**: Set up secure bcrypt authentication for production readiness, but enabled a "select user" bypass for the assignment demo so evaluators can easily switch accounts without passwords.

### 3. Multi-Currency (Priya's Constraint)
- **Decision**: Centralized USD to INR conversion.
- **Options**: Live API rates vs. Configurable static rate.
- **Why**: A live API is overkill for a 5-day Goa trip. We implemented a dynamic `.env` variable (`USD_TO_INR_RATE`) that converts all USD expenses to INR at import time, saving the exact rate in the database permanently to prevent historical balance drift.

### 4. Membership Timelines (Sam's & Meera's Constraints)
- **Decision**: `joined_at` and `left_at` timestamps on GroupMemberships.
- **Options**: Simple boolean `is_active` vs. Timestamp records.
- **Why**: A boolean doesn't track *when* someone was active. Using timestamps allows the import engine to strictly flag expenses if a user hadn't moved in yet (Sam) or had already moved out (Meera).

### 5. CSV Import & Approval (Meera's Constraint)
- **Decision**: 4-Step Interactive Import Wizard.
- **Options**: Silent one-click import vs. Interactive review.
- **Why**: Meera demanded approval over changes. The wizard flags all anomalies (like percentages summing to 110%, or duplicate Marina Bites dinners) and explicitly halts, requiring user confirmation before database insertion.

### 6. Debt Simplification (Aisha's Constraint)
- **Decision**: Greedy matching algorithm.
- **Options**: Showing all 15+ pairwise debts vs. Algorithmic simplification.
- **Why**: Aisha explicitly wanted "one number per person." The greedy algorithm minimizes the number of required transfers by matching the biggest debtors directly to the biggest creditors.
