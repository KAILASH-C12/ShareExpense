# AI_USAGE.md — AI Tools, Prompts, and Corrections

## AI Tool Used

**Primary**: Google Gemini (Antigravity IDE / Claude Opus 4.6 Thinking) — agentic coding assistant with file editing, terminal commands, and code generation capabilities.

**Role**: Used as a pair-programming collaborator for:
- Architecture planning and decision-making
- Code generation (components, API routes, import engine)
- CSS design system creation
- Documentation writing
- Database schema design

## Key Prompts

### Prompt 1: Project Kickoff
> "Build a shared expenses app for flatmates with CSV import, anomaly detection, balance calculation, and settlements. Handle messy real-world data with 12+ deliberate problems."

This was the main prompt that drove the architecture. The AI suggested the 4-step import wizard and the anomaly detection pipeline approach.

### Prompt 2: Import Engine Design
> "Design the CSV anomaly detection pipeline to catch duplicates, name mismatches, date format issues, percentage validation, membership violations, and misclassified settlements."

The AI proposed a two-pass approach: single-row checks first, then cross-row checks (duplicates). This was a good architectural pattern.

### Prompt 3: Balance Calculation
> "Calculate net balances for each member considering: multi-currency (USD→INR), settlements, membership periods, and all 4 split types (equal, unequal, percentage, share)."

### Prompt 4: UI Design
> "Create a premium dark-mode design with glassmorphism cards, gradient accents, and smooth animations using GSAP-style CSS animations."

---

## Three Concrete Cases Where the AI Was Wrong

### Case 1: Percentage Calculation Bug in Balance Engine

**What the AI generated**:
```typescript
// Original AI code in calculateShares()
shares[normalized] = Math.round((amountInr * effectivePct) / 10000) * 100 / 100;
```

**What was wrong**: The rounding operation divided by 10000 instead of 100. This meant percentage splits were being calculated as 0.01x the correct value. For Pizza Friday (₹1440 at 27.27%), the AI code would give ₹3.93 instead of ₹392.73.

**How I caught it**: Manual balance verification. I hand-calculated Aisha's share for Pizza Friday:
- ₹1440 × 27.27% = ₹392.73 (expected)
- The code was producing ₹3.93 (1/100th of correct)

**What I changed**: Fixed the formula to:
```typescript
shares[normalized] = Math.round((amountInr * effectivePct / 100) * 100) / 100;
```

### Case 2: npm Package Name Conflict

**What the AI did**: Initially tried to install `@studio-freight/lenis` which is a deprecated package name.

**What was wrong**: The `@studio-freight/lenis` package has been renamed to just `lenis`. npm issued a deprecation warning, and the old package may have compatibility issues with newer Node.js versions.

**How I caught it**: npm displayed a deprecation warning during install:
```
npm warn deprecated @studio-freight/lenis@1.0.42: The '@studio-freight/lenis' package has been renamed to 'lenis'
```

**What I changed**: For production, the package should be updated to `lenis` (new name). For the current build, the deprecated package still works.

### Case 3: Ambiguous Date Logic Over-Triggering

**What the AI generated**: The initial date parsing logic flagged ALL DD/MM/YYYY dates as ambiguous if both parts were ≤ 12.

**What was wrong**: This meant dates like "01/03/2026" (obviously January 3 or March 1) were flagged as ambiguous even though contextual evidence (Indian flatmates, consistent DD/MM pattern) makes them clearly DD/MM. The AI was being overly cautious.

**How I caught it**: During import testing, 15+ rows were flagged as "ambiguous date" when only "04/05/2026" was genuinely ambiguous. Real ambiguity only exists when:
1. Both values ≤ 12 AND
2. They are different (same day/month like 03/03 is unambiguous) AND
3. There's no surrounding context to resolve it

**What I changed**: Added context-awareness: only flag as truly ambiguous when both values differ AND there's a note expressing uncertainty. Other DD/MM dates are auto-parsed as DD/MM with "info" severity (not "error").

---

## AI Collaboration Process

1. **I drove the architecture**: The AI didn't know about the assignment requirements, flatmate backstories, or CSV anomalies. I analyzed the CSV by hand first and identified the 20 data problems before asking the AI to build the detection engine.

2. **I reviewed every line**: The AI generated significant amounts of code. I read through each file, verified the logic against hand calculations, and fixed issues like the percentage bug above.

3. **I made product decisions**: The AI provided options (e.g., for date ambiguity handling), but I chose DD/MM/YYYY based on understanding that these are Indian flatmates using Indian date conventions.

4. **I tested edge cases**: The AI's initial duplicate detection had a too-low similarity threshold (0.3), which would have flagged "Groceries BigBasket" and "Groceries DMart" as duplicates. I raised it to 0.5.

5. **The AI accelerated but didn't replace**: Without the AI, this project would take 5-7 days. With it, the core implementation was done in ~2 days. But every decision — from schema design to anomaly handling policies — was mine.
