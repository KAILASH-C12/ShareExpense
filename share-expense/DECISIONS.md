# DECISIONS.md — Decision Log

Every significant engineering and product decision made during the ShareExpense project, with options considered and rationale.

---

## Decision 1: Framework Choice — Next.js 15 (App Router)

**Context**: Need a full-stack framework for a relational-DB-backed expense app with authentication, API routes, and dynamic UI.

**Options Considered**:
| Option | Pros | Cons |
|--------|------|------|
| Next.js (App Router) | Full-stack, SSR/SSG, API routes, great DX | Learning curve for App Router |
| Vite + Express | Lightweight, fast HMR | Separate frontend/backend, more boilerplate |
| Django + React | Python backend, ORM | Two languages, heavier deployment |
| SvelteKit | Fast, lightweight | Smaller ecosystem |

**Decision**: **Next.js 15 with App Router**. One codebase, built-in API routes, Prisma integration works seamlessly, and Vercel deployment is trivial. The assignment requires deployment, and Vercel + Neon gives us free, production-ready hosting.

---

## Decision 2: Database — PostgreSQL (Neon)

**Context**: Assignment requires relational DB only. Need hosted solution for deployment.

**Options Considered**:
| Option | Pros | Cons |
|--------|------|------|
| Neon PostgreSQL | Free tier, serverless, fast cold starts | Newer service |
| Supabase | Full BaaS, auth built in | Heavier than needed |
| PlanetScale (MySQL) | Good DX | MySQL, not PostgreSQL |
| Local SQLite | Zero setup | Not production-ready, no concurrent access |

**Decision**: **Neon PostgreSQL**. Free serverless PostgreSQL with generous free tier. Prisma has first-class support. Solves the "relational DB" requirement cleanly.

---

## Decision 3: Authentication — Simplified Credentials

**Context**: 6 flatmates need to log in. Full OAuth seems overkill for a flat-sharing app.

**Options Considered**:
1. **Full NextAuth with OAuth** (Google/GitHub) — overkill, flatmates don't need OAuth
2. **NextAuth Credentials** with bcrypt — proper auth, good for demo
3. **Simple localStorage** with user selection — fastest for demo, no server auth
4. **Hybrid**: NextAuth config exists, but login uses localStorage for immediate demo

**Decision**: **Hybrid approach**. NextAuth v5 is configured with credentials provider and bcrypt (production-ready). But for the demo, login uses localStorage user selection for frictionless testing. This lets evaluators quickly switch between users without passwords while the auth infrastructure is real.

---

## Decision 4: Currency Handling — Fixed Exchange Rate

**Context**: Goa trip had USD expenses. Priya says "a dollar is not a rupee."

**Options Considered**:
1. **Live API exchange rates** — accurate but adds API dependency, rate varies over time
2. **User-configurable rate per expense** — flexible but complex UI
3. **Single configurable rate per group** — simple, reasonable for a short trip window
4. **Ignore (treat as same currency)** — the current broken behavior

**Decision**: **Single configurable rate (₹83.50/USD)**. The Goa trip was a 5-day window, so exchange rate fluctuation is negligible. Stored as `exchange_rate` column on each expense. Can be changed per-expense if needed later. The rate converts all USD amounts to INR for unified balance calculations.

**Trade-off accepted**: Slightly less accurate than live rates, but vastly simpler and sufficient for a short trip.

---

## Decision 5: Membership Timeline — join/leave Dates on GroupMembership

**Context**: Sam says "Why would March electricity affect my balance?" and Meera moved out.

**Options Considered**:
1. **Simple boolean `is_active`** — doesn't capture when they joined/left
2. **`joined_at` + `left_at` timestamps** — full timeline, query-able
3. **Separate membership events table** — supports re-joining, most complex
4. **No membership tracking** — split_with in CSV determines everything

**Decision**: **`joined_at` + `left_at` on GroupMembership**. The `left_at` being NULL means the member is still active. This lets us query membership at any point in time. The CSV import engine cross-references expense dates against membership periods to flag violations (e.g., Meera in April splits).

**Why not option 3**: Nobody re-joins in our scenario. If they did, we'd create a new GroupMembership row.

---

## Decision 6: Duplicate Detection — Fuzzy Description Matching

**Context**: "Dinner at Marina Bites" vs "dinner - marina bites" — same event, different logging.

**Options Considered**:
1. **Exact string match** — misses "dinner - marina bites" vs "Dinner at Marina Bites"
2. **Levenshtein distance** — character-level, might miss word reorderings
3. **Jaccard similarity on word sets** — handles word order, casing, punctuation
4. **Manual dedup only** — leave it to the user

**Decision**: **Jaccard similarity > 0.5 threshold**. Normalize descriptions (lowercase, remove punctuation, split to words, sort), compute Jaccard coefficient (intersection/union of word sets). Threshold of 0.5 catches "Dinner at Marina Bites" ↔ "dinner - marina bites" (Jaccard ≈ 0.6) while avoiding false positives on genuinely different expenses.

---

## Decision 7: Settlement vs Expense Detection

**Context**: "Rohan paid Aisha back" is logged as an expense but is actually a settlement.

**Options Considered**:
1. **Keyword detection only** — search for "paid back", "settlement", "deposit"
2. **Structural detection** — no split_type + single person in split_with
3. **Both combined** — highest accuracy
4. **Manual classification during review** — most accurate, most work

**Decision**: **Combined keyword + structural detection**. Check for:
- Keywords: "paid back", "settlement", "deposit", "repaid"
- Structure: empty split_type AND only 1 person in split_with
If either signals settlement, flag as `misclassified` and suggest converting. User confirms during import review (Meera's approval requirement).

---

## Decision 8: Percentage Normalization — Proportional Scaling

**Context**: Pizza Friday percentages total 110% (30+30+30+20).

**Options Considered**:
1. **Reject the row** — too strict, data loss
2. **Normalize proportionally** — divide each by total, multiply by 100
3. **Cap at 100%, reduce last person** — unfair to last person
4. **Flag and let user manually fix** — most accurate but slowest

**Decision**: **Normalize proportionally + flag for review**. Each percentage is divided by 110 and multiplied by 100: Aisha 27.27%, Rohan 27.27%, Priya 27.27%, Meera 18.18%. The row is imported with normalized percentages but flagged so the user can override.

**Mathematical justification**: If everyone agreed on their relative shares (3:3:3:2 ratio), proportional normalization preserves the intent while making the math work.

---

## Decision 9: Ambiguous Date "04/05/2026" — Default to DD/MM/YYYY

**Context**: Could be April 5 (MM/DD) or May 4 (DD/MM).

**Options Considered**:
1. **MM/DD/YYYY** (American) — gives April 5
2. **DD/MM/YYYY** (Indian/European) — gives May 4
3. **Flag as error and skip** — data loss
4. **Flag for user resolution** — safest

**Decision**: **Default to DD/MM/YYYY (May 4) + flag for confirmation**. Rationale:
- All other slash-dated entries in the CSV use DD/MM (01/03, 03/03, 05/03, etc.)
- The data is from Indian flatmates → DD/MM is the local convention
- The note itself says "is this April 5 or May 4? format is a mess" — acknowledging ambiguity
- Flagged as "error" severity so user must explicitly approve

---

## Decision 10: Negative Amounts — Treat as Refunds

**Context**: Parasailing refund is -$30 USD.

**Options Considered**:
1. **Reject negative amounts** — loses refund data
2. **Convert to positive expense** — misrepresents the transaction
3. **Treat as credit/refund** — mathematically correct
4. **Create a separate refund entity** — adds complexity

**Decision**: **Keep as negative expense**. A negative amount in a split reduces each participant's share proportionally. The notes confirm "one slot got cancelled" — this is a legitimate refund that should reduce everyone's parasailing cost. No new entity needed; the existing split logic handles negatives naturally.

---

## Decision 11: Balance Calculation — Per-Split INR Conversion

**Context**: Need to compute "who owes whom" across INR and USD expenses.

**Options Considered**:
1. **Store all amounts in original currency, convert at display time** — complex
2. **Convert to INR at import time, store both** — queryable in one currency
3. **Track per-currency balances separately** — accurate but complex for users

**Decision**: **Store both original amount and INR equivalent**. Each `ExpenseSplit` has `share_amount` (original) and `share_amount_inr` (converted). Balance calculations always use `share_amount_inr` for consistency. This satisfies Priya's requirement while keeping the math simple.

---

## Decision 12: Debt Simplification — Greedy Algorithm

**Context**: Aisha wants "one number per person."

**Options Considered**:
1. **Show all pairwise debts** — too many transactions
2. **Greedy matching** — O(n log n), not always minimum but close
3. **Min-cost flow / LP solver** — optimal but overkill
4. **Round-robin** — simple but not minimal

**Decision**: **Greedy matching**. Separate people into creditors (positive net balance) and debtors (negative). Sort both descending. Match largest debtor to largest creditor, transfer the minimum of the two amounts. Repeat. This minimizes transfers in most real-world cases.

---

## Decision 13: Import Review UX — 4-Step Wizard

**Context**: Meera says "I want to approve anything the app deletes or changes."

**Options Considered**:
1. **One-click import** — fastest, but silent about anomalies (fails Meera's requirement)
2. **Full spreadsheet editor** — overwhelming
3. **Step-by-step wizard** (Upload → Review → Confirm → Report) — guided, clear
4. **Anomaly-only review** — show only problems, not all data

**Decision**: **4-step wizard with anomaly review + full expense preview**. Step 2 shows every anomaly with approve/reject buttons, plus a full preview table where any row can be toggled to skip/include. This gives Meera full control while not overwhelming users with the full spreadsheet.

---

## Decision 14: Dev's Friend Kabir — Guest User

**Context**: "Dev's friend Kabir" joined for one parasailing activity.

**Options Considered**:
1. **Ignore Kabir, absorb into Dev's share** — simplest but inaccurate
2. **Create a guest user "Kabir"** — tracks his share but he's not a real member
3. **Flag and let user decide** — flexible
4. **Split only among registered members** — unfair to registered members

**Decision**: **Flag for user review**. The import engine detects "Dev's friend Kabir" as unknown and flags it. Options are presented during import review. Default behavior: if user doesn't resolve, Kabir is treated as a real participant whose share is tracked but who may not be contacted for collection (Dev would presumably cover it).

---

## Decision 15: Rounding Strategy — Round to Nearest Paisa

**Context**: Equal splits of odd amounts (₹1199 ÷ 4 = ₹299.75) create fractions.

**Decision**: **Round each split to 2 decimal places (nearest paisa)**. The sub-paisa difference (max ₹0.01 per split) is acceptable. All comparisons use ₹0.50 threshold for "zero balance" to avoid floating-point dust showing as pending debts.
