# SCOPE.md — Anomaly Log & Database Schema

## Part 1: CSV Anomaly Log

The `expenses_export.csv` file contains **41 data rows** and at least **20 deliberate data problems**. Below is every anomaly detected by our import engine, categorized by type, with the handling policy documented.

---

### Anomaly #1: Duplicate Expense — Dinner at Marina Bites
- **Rows**: 5, 6 (CSV)
- **Type**: `duplicate`
- **Severity**: ⚠️ Warning
- **Problem**: Two entries for the same dinner: "Dinner at Marina Bites" (row 5) and "dinner - marina bites" (row 6). Same payer (Dev), same date (Feb 8), same amount (₹3,200).
- **Detection**: Fuzzy description matching + same date + same payer + same amount
- **Handling**: **Skip the second row**. The duplicate is detected via normalized description similarity (>50% Jaccard overlap). Row 5 is kept (has notes about Dev visiting), row 6 is skipped.
- **User Action**: User can override to keep row 6 instead during import review.

### Anomaly #2: Formatted Number — Electricity Feb
- **Row**: 7
- **Type**: `format_issue`
- **Severity**: ℹ️ Info
- **Problem**: Amount "1,200" contains comma as thousands separator instead of plain number.
- **Detection**: Regex check for commas in amount field
- **Handling**: **Auto-fix**: Strip commas, parse as 1200. Logged for transparency.

### Anomaly #3: Inconsistent Name Casing — "priya"
- **Row**: 9
- **Type**: `name_mismatch`
- **Severity**: ℹ️ Info
- **Problem**: Payer listed as "priya" (lowercase) instead of "Priya".
- **Detection**: Case-insensitive lookup against known member list
- **Handling**: **Auto-fix**: Normalize to "Priya" via title-case matching. Logged.

### Anomaly #4: Name Variant — "Priya S"
- **Row**: 11
- **Type**: `name_mismatch`
- **Severity**: ⚠️ Warning
- **Problem**: Payer listed as "Priya S" (with last initial) — not an exact match to "Priya".
- **Detection**: Fuzzy name matching against known member map
- **Handling**: **Auto-fix**: Map "Priya S" → "Priya". Flagged for user confirmation since it's a fuzzy match.

### Anomaly #5: Missing Payer — House Cleaning Supplies
- **Row**: 13
- **Type**: `missing_data`
- **Severity**: 🔴 Error
- **Problem**: `paid_by` field is empty. Notes say "can't remember who paid".
- **Detection**: Empty/null check on `paid_by` field
- **Handling**: **Flag for review**. Cannot import without a payer — the expense is imported as flagged, requiring user to assign a payer. Does not affect balance calculations until resolved.

### Anomaly #6: Settlement Logged as Expense — "Rohan paid Aisha back"
- **Row**: 14
- **Type**: `misclassified`
- **Severity**: ⚠️ Warning
- **Problem**: Description contains "paid back" and notes say "this is a settlement not an expense??". No split_type, only one person in split_with.
- **Detection**: Keyword matching ("paid back", "settlement", "deposit") + single recipient in split_with + empty split_type
- **Handling**: **Convert to settlement**. Imported as a Settlement record (Rohan → Aisha, ₹5,000) instead of an Expense. Flagged for confirmation.

### Anomaly #7: Percentages Total 110% — Pizza Friday
- **Row**: 15
- **Type**: `invalid_split`
- **Severity**: ⚠️ Warning
- **Problem**: Split percentages: Aisha 30% + Rohan 30% + Priya 30% + Meera 20% = **110%**, not 100%. Notes say "percentages might be off".
- **Detection**: Sum of percentage values ≠ 100 (within 0.01 tolerance)
- **Handling**: **Normalize proportionally**: Divide each percentage by 110 and multiply by 100. Result: Aisha 27.27%, Rohan 27.27%, Priya 27.27%, Meera 18.18%. Flagged for confirmation.

### Anomaly #8: Date Format — DD/MM/YYYY Entries
- **Rows**: 16–32, 33
- **Type**: `format_issue`
- **Severity**: ℹ️ Info
- **Problem**: March entries use DD/MM/YYYY format (e.g., "01/03/2026") while February uses ISO YYYY-MM-DD.
- **Detection**: Regex matching for slash-separated dates
- **Handling**: **Auto-fix**: Parse as DD/MM/YYYY (consistent with the majority of slash-dated entries: 01/03, 03/03, 05/03, etc., where the first number is clearly the day). Converted to ISO dates internally.

### Anomaly #9: Duplicate Dinner (Conflicting Amounts) — Thalassa
- **Rows**: 24, 25
- **Type**: `duplicate_conflict`
- **Severity**: 🔴 Error
- **Problem**: Two entries for same dinner at Thalassa on Mar 11. Aisha logged ₹2,400 (row 24), Rohan logged ₹2,450 (row 25) with note "Aisha also logged this I think hers is wrong".
- **Detection**: Same date + similar description (>50% Jaccard) + different payers + different amounts
- **Handling**: **Flag both for review**. Default suggestion: keep Rohan's entry (₹2,450) based on his note indicating Aisha's amount is wrong. User can override.

### Anomaly #10: Missing Currency — Groceries DMart Mar 15
- **Row**: 28
- **Type**: `missing_data`
- **Severity**: ⚠️ Warning
- **Problem**: Currency field is empty. Notes: "forgot to set currency".
- **Detection**: Empty/null check on currency field
- **Handling**: **Auto-fix**: Default to INR (most common currency, domestic expense context). Logged and flagged for confirmation.

### Anomaly #11: Zero Amount — Dinner Order Swiggy
- **Row**: 31
- **Type**: `zero_amount`
- **Severity**: ⚠️ Warning
- **Problem**: Amount is 0. Notes: "counted twice earlier - fixing later".
- **Detection**: Amount === 0 check
- **Handling**: **Skip row**. A ₹0 expense has no financial meaning. The notes indicate it was intentionally zeroed out as a correction. Logged.

### Anomaly #12: Ambiguous Date — "04/05/2026"
- **Row**: 33
- **Type**: `ambiguous_date`
- **Severity**: 🔴 Error
- **Problem**: "04/05/2026" could be April 5 (MM/DD) or May 4 (DD/MM). Notes: "is this April 5 or May 4? format is a mess".
- **Detection**: Both parts ≤ 12 and ≠ each other → ambiguous
- **Handling**: **Interpret as DD/MM/YYYY → May 4, 2026**. Rationale: other DD/MM entries in the CSV (01/03, 03/03, 05/03) consistently use DD/MM format. Flagged for user confirmation due to genuine ambiguity.

### Anomaly #13: Negative Amount — Parasailing Refund
- **Row**: 26
- **Type**: `negative_amount`
- **Severity**: ℹ️ Info
- **Problem**: Amount is -30 USD. Notes: "one slot got cancelled".
- **Detection**: Amount < 0 check
- **Handling**: **Keep as-is (refund)**. Negative amounts represent credits/refunds. The notes confirm this is a legitimate partial refund. The negative amount reduces each participant's share by $6 (for 5 people including Kabir... wait, this split is among 4 people so $7.50 each).

### Anomaly #14: Departed Member in Split — April Groceries
- **Row**: 35
- **Type**: `membership_violation`
- **Severity**: ⚠️ Warning
- **Problem**: Meera is in the split_with for April 2 Groceries, but she moved out on March 31. Notes: "oops Meera still in the group list".
- **Detection**: Cross-reference expense date against membership periods
- **Handling**: **Flag for review**. Meera should not be charged for expenses after her departure. Suggested fix: remove Meera from this split, redistribute equally among active members (Aisha, Rohan, Priya).

### Anomaly #15: Incomplete Date — "Mar 14"
- **Row**: 27
- **Type**: `format_issue`
- **Severity**: ℹ️ Info
- **Problem**: Date "Mar 14" has no year.
- **Detection**: Month-abbreviation regex with no year component
- **Handling**: **Auto-fix**: Infer year 2026 from surrounding entries (all in 2026). Result: March 14, 2026.

### Anomaly #16: Non-Member in Split — "Dev's friend Kabir"
- **Row**: 22
- **Type**: `unknown_member`
- **Severity**: ⚠️ Warning
- **Problem**: "Dev's friend Kabir" is listed in the parasailing split. Kabir is not a registered group member.
- **Detection**: Name not found in known member list
- **Handling**: **Flag for review**. Options: (a) create a guest "Kabir" user so his share is tracked, (b) absorb Kabir's share into Dev's (since Dev invited him). Default: flag for user to decide.

### Anomaly #17: Conflicting Split Metadata — Furniture
- **Row**: 40
- **Type**: `conflicting_data`
- **Severity**: ℹ️ Info
- **Problem**: split_type is "equal" but split_details contains "Aisha 1; Rohan 1; Priya 1; Sam 1". Notes: "split_type says equal but someone added shares anyway".
- **Detection**: Non-empty split_details when split_type is "equal" → check if shares are all identical
- **Handling**: **Auto-fix**: Shares 1:1:1:1 are mathematically equal. Treat as equal split, ignore redundant share data. Logged.

### Anomaly #18: Deposit as Expense — "Sam deposit share"
- **Row**: 37
- **Type**: `misclassified`
- **Severity**: ⚠️ Warning
- **Problem**: "Sam deposit share" with split_with = "Aisha" only. This is Sam paying his security deposit share to Aisha, not a group expense.
- **Detection**: Keyword "deposit" + single recipient in split_with
- **Handling**: **Convert to settlement** (Sam → Aisha, ₹15,000). It's a financial transfer between two members, not a shared expense.

### Anomaly #19: Excessive Precision — Cylinder Refill
- **Row**: 10
- **Type**: `precision_issue`
- **Severity**: ℹ️ Info
- **Problem**: Amount 899.995 has 3 decimal places — real-world payments use max 2.
- **Detection**: More than 2 decimal places in amount
- **Handling**: **Auto-fix**: Round to 2 decimal places → ₹900.00. Logged.

### Anomaly #20: Percentage Split Sums to 110% — Weekend Brunch
- **Row**: 32
- **Type**: `invalid_split`
- **Severity**: ⚠️ Warning
- **Problem**: Same issue as Anomaly #7: Aisha 30% + Rohan 30% + Priya 30% + Meera 20% = 110%.
- **Detection**: Sum of percentages ≠ 100
- **Handling**: Same as #7 — normalize proportionally. Flagged.

---

## Summary Statistics

| Category | Count |
|----------|-------|
| **Total anomalies** | 20 |
| **Auto-fixed** (info) | 8 |
| **Flagged for review** (warning/error) | 10 |
| **Skipped rows** | 2 |

| Anomaly Type | Count |
|-------------|-------|
| format_issue | 4 |
| name_mismatch | 2 |
| missing_data | 3 |
| misclassified | 2 |
| invalid_split | 2 |
| duplicate | 1 |
| duplicate_conflict | 1 |
| ambiguous_date | 1 |
| unknown_member | 1 |
| membership_violation | 1 |
| zero_amount | 1 |
| negative_amount | 1 |
| precision_issue | 1 |
| conflicting_data | 1 |

---

## Part 2: Database Schema

### Entity-Relationship Diagram

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│    User      │────<│  GroupMembership  │>────│    Group     │
│  (6 users)   │     │  (join/leave)     │     │ (Flatmates)  │
└──────┬───────┘     └──────────────────┘     └──────┬───────┘
       │                                              │
       │ paid_by                                      │ belongs_to
       ▼                                              ▼
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Expense    │────<│  ExpenseSplit     │     │  Settlement  │
│  (41 rows)   │     │  (per-person)     │     │  (payments)  │
└─────────────┘     └──────────────────┘     └─────────────┘
       │
       │ import_source
       ▼
┌─────────────┐     ┌──────────────────┐
│ ImportReport │────<│  ImportAnomaly   │
│  (per import)│     │  (20+ issues)    │
└─────────────┘     └──────────────────┘
```

### Table Definitions

#### `users`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Auto-increment |
| name | VARCHAR | NOT NULL | Display name (Aisha, Rohan, etc.) |
| email | VARCHAR | UNIQUE | Login email |
| password_hash | VARCHAR | NOT NULL | bcrypt hash |
| created_at | TIMESTAMP | DEFAULT NOW() | |

#### `groups`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | |
| name | VARCHAR | NOT NULL | "Flatmates" |
| description | TEXT | NULLABLE | |
| created_by | INT | FK → users.id | |
| created_at | TIMESTAMP | DEFAULT NOW() | |

#### `group_memberships`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | |
| user_id | INT | FK → users.id | |
| group_id | INT | FK → groups.id | |
| joined_at | TIMESTAMP | NOT NULL | When member joined |
| left_at | TIMESTAMP | NULLABLE | NULL = still active |
| role | VARCHAR | DEFAULT 'member' | admin or member |

**Key design**: `left_at` being nullable means active members. This lets us query membership at any point in time, enforcing Sam's requirement that March electricity doesn't affect his balance.

#### `expenses`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | |
| group_id | INT | FK → groups.id | |
| paid_by_user_id | INT | FK → users.id | Who paid |
| description | VARCHAR | NOT NULL | |
| amount | DECIMAL(12,2) | NOT NULL | Original currency amount |
| currency | VARCHAR | DEFAULT 'INR' | INR or USD |
| exchange_rate | DECIMAL(10,4) | DEFAULT 1.0 | 83.5 for USD→INR |
| split_type | VARCHAR | NOT NULL | equal/unequal/percentage/share |
| notes | TEXT | NULLABLE | |
| expense_date | DATE | NOT NULL | |
| is_settlement | BOOLEAN | DEFAULT false | |
| import_source | VARCHAR | NULLABLE | 'csv' or 'manual' |
| import_row | INT | NULLABLE | CSV row number for traceability |
| created_at | TIMESTAMP | DEFAULT NOW() | |

#### `expense_splits`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | |
| expense_id | INT | FK → expenses.id (CASCADE) | |
| user_id | INT | FK → users.id | |
| share_amount | DECIMAL(12,2) | NOT NULL | In original currency |
| share_amount_inr | DECIMAL(12,2) | NOT NULL | Converted to INR |
| percentage | DECIMAL(6,2) | NULLABLE | For percentage splits |
| share_units | DECIMAL(6,2) | NULLABLE | For share splits |

**UNIQUE(expense_id, user_id)** — one split per person per expense.

#### `settlements`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | |
| group_id | INT | FK → groups.id | |
| from_user_id | INT | FK → users.id | Payer |
| to_user_id | INT | FK → users.id | Receiver |
| amount | DECIMAL(12,2) | NOT NULL | |
| currency | VARCHAR | DEFAULT 'INR' | |
| settlement_date | DATE | NOT NULL | |
| notes | TEXT | NULLABLE | |
| import_source | VARCHAR | NULLABLE | |
| import_row | INT | NULLABLE | |
| created_at | TIMESTAMP | DEFAULT NOW() | |

#### `import_reports`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | |
| group_id | INT | FK → groups.id | |
| filename | VARCHAR | NOT NULL | |
| total_rows | INT | NOT NULL | |
| imported_ok | INT | NOT NULL | Successfully imported |
| anomalies_found | INT | NOT NULL | |
| skipped | INT | DEFAULT 0 | |
| imported_at | TIMESTAMP | DEFAULT NOW() | |
| imported_by | INT | FK → users.id | |

#### `import_anomalies`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | |
| import_report_id | INT | FK → import_reports.id (CASCADE) | |
| csv_row | INT | NOT NULL | Original CSV row number |
| anomaly_type | VARCHAR | NOT NULL | e.g., "duplicate", "missing_data" |
| severity | VARCHAR | NOT NULL | error / warning / info |
| description | TEXT | NOT NULL | Human-readable explanation |
| original_data | TEXT | NOT NULL | JSON of original CSV row |
| action_taken | VARCHAR | NOT NULL | auto_fixed / flagged / skipped |
| resolution_details | TEXT | NULLABLE | What was fixed |
| user_approved | BOOLEAN | DEFAULT false | Meera's requirement |
