# AI Usage Report

## 🛠️ AI Tools Used
- **Google Gemini (Antigravity IDE)**: Used as an agentic pair-programming assistant for architecture, Next.js code generation, and UI styling.

## 🗣️ Key Prompts
1. *"Build a shared expenses app for flatmates with a CSV anomaly detection engine that catches duplicates, missing data, and invalid splits."*
2. *"Design a robust Prisma database schema with group membership timelines (joined_at, left_at)."*
3. *"Create a premium dark-mode UI with glassmorphism cards and smooth animations."*

## ❌ Three AI Mistakes & How I Fixed Them

**1. Percentage Calculation Bug**
- **Error**: The AI wrote `Math.round((amount * pct) / 10000)` which calculated percentage splits as 1/100th of their actual value (e.g., ₹3.93 instead of ₹392).
- **Fix**: I caught this during manual balance verification and corrected the math formula to `(amount * pct / 100)`.

**2. Deprecated Package Installation**
- **Error**: The AI tried to install `@studio-freight/lenis` (which is deprecated) instead of the new `lenis` package for animations.
- **Fix**: I saw the npm deprecation warning in the terminal and updated the dependency in `package.json` to the correct modern package.

**3. Overly Strict Date Parsing**
- **Error**: The AI flagged *every* `DD/MM` date (like "01/03/2026") as ambiguous if both numbers were under 12, causing 15+ false-positive errors.
- **Fix**: I rewrote the logic to only flag dates as ambiguous if they genuinely conflict and lack surrounding contextual proof, changing the others to auto-fixing `info` alerts.
