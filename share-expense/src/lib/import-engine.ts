/**
 * CSV Import Engine for ShareExpense
 * 
 * This module handles parsing, anomaly detection, and resolution for
 * the expenses_export.csv file. It detects 15+ data problems and surfaces
 * them to the user with recommended actions.
 * 
 * Architecture:
 * 1. csvParser - Raw CSV → typed rows
 * 2. anomalyDetector - Rows → anomalies
 * 3. resolver - Anomalies → fixed rows + report
 */

// ─── TYPES ─────────────────────────────────────────────────────────

export interface RawCSVRow {
  date: string;
  description: string;
  paid_by: string;
  amount: string;
  currency: string;
  split_type: string;
  split_with: string;
  split_details: string;
  notes: string;
  rowIndex: number; // 1-based CSV row number (header = row 0)
}

export interface ImportAnomaly {
  id: string;
  csvRow: number;
  anomalyType: AnomalyType;
  severity: "error" | "warning" | "info";
  description: string;
  originalData: string; // JSON of original row
  suggestedAction: SuggestedAction;
  autoFixValue?: string; // The auto-corrected value
  field?: string; // Which field has the problem
  relatedRows?: number[]; // For duplicates — related rows
  userApproved: boolean;
}

export type AnomalyType =
  | "duplicate"
  | "duplicate_conflict"
  | "format_issue"
  | "name_mismatch"
  | "missing_data"
  | "misclassified"
  | "invalid_split"
  | "ambiguous_date"
  | "unknown_member"
  | "membership_violation"
  | "invalid_amount"
  | "precision_issue"
  | "conflicting_data"
  | "negative_amount"
  | "zero_amount";

export type SuggestedAction =
  | "auto_fixed"
  | "skip_row"
  | "flag_for_review"
  | "keep_as_is"
  | "convert_to_settlement";

export interface ParsedExpense {
  rowIndex: number;
  date: Date | null;
  dateString: string;
  description: string;
  paidBy: string;
  amount: number;
  currency: string;
  splitType: string;
  splitWith: string[];
  splitDetails: Record<string, number>;
  notes: string;
  isSettlement: boolean;
  anomalies: ImportAnomaly[];
  skip: boolean; // Should this row be skipped in import?
}

export interface ImportResult {
  totalRows: number;
  parsedExpenses: ParsedExpense[];
  anomalies: ImportAnomaly[];
  importedCount: number;
  skippedCount: number;
  flaggedCount: number;
}

// ─── KNOWN MEMBERS ─────────────────────────────────────────────────

const KNOWN_MEMBERS = ["Aisha", "Rohan", "Priya", "Meera", "Dev", "Sam"];

const NAME_VARIANTS: Record<string, string> = {
  "priya": "Priya",
  "priya s": "Priya",
  "rohan": "Rohan",
  "aisha": "Aisha",
  "meera": "Meera",
  "dev": "Dev",
  "sam": "Sam",
};

// Membership periods: [joinDate, leaveDate | null]
const MEMBERSHIP_PERIODS: Record<string, { joined: string; left: string | null }> = {
  "Aisha": { joined: "2026-02-01", left: null },
  "Rohan": { joined: "2026-02-01", left: null },
  "Priya": { joined: "2026-02-01", left: null },
  "Meera": { joined: "2026-02-01", left: "2026-03-31" },
  "Dev":   { joined: "2026-02-08", left: "2026-03-14" },
  "Sam":   { joined: "2026-04-08", left: null },
};

const USD_TO_INR = process.env.USD_TO_INR_RATE ? parseFloat(process.env.USD_TO_INR_RATE) : 83.5;

// ─── DATE PARSING ──────────────────────────────────────────────────

/**
 * Parses various date formats found in the CSV:
 * - YYYY-MM-DD (ISO)
 * - DD/MM/YYYY
 * - "Mar 14" (month abbreviation, no year)
 * 
 * Returns { date, format, isAmbiguous }
 */
function parseDate(dateStr: string): {
  date: Date | null;
  format: string;
  isAmbiguous: boolean;
  ambiguityNote?: string;
} {
  const trimmed = dateStr.trim();

  // ISO format: YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return { date: new Date(+y, +m - 1, +d), format: "ISO", isAmbiguous: false };
  }

  // DD/MM/YYYY format
  const slashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, first, second, year] = slashMatch;
    const day = +first;
    const month = +second;

    // Ambiguity check: if both values could be month (1-12)
    if (day <= 12 && month <= 12 && day !== month) {
      // Check if context suggests DD/MM (European) — surrounding rows use DD/MM
      // For "04/05/2026" this is ambiguous
      if (day <= 12 && month <= 12) {
        // We use DD/MM/YYYY based on other entries in the CSV (01/03, 03/03, 05/03 etc.)
        return {
          date: new Date(+year, month - 1, day),
          format: "DD/MM/YYYY",
          isAmbiguous: true,
          ambiguityNote: `Could be ${day}/${month}/${year} (DD/MM) or ${month}/${day}/${year} (MM/DD). Using DD/MM/YYYY format.`,
        };
      }
    }

    return { date: new Date(+year, month - 1, day), format: "DD/MM/YYYY", isAmbiguous: false };
  }

  // Month abbreviation: "Mar 14"
  const monthAbbrMatch = trimmed.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})$/i);
  if (monthAbbrMatch) {
    const [, monthStr, dayStr] = monthAbbrMatch;
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const month = months[monthStr.toLowerCase()];
    // Assume year 2026 based on surrounding data
    return {
      date: new Date(2026, month, +dayStr),
      format: "Mon DD (no year)",
      isAmbiguous: false,
    };
  }

  return { date: null, format: "unknown", isAmbiguous: false };
}

// ─── AMOUNT PARSING ────────────────────────────────────────────────

function parseAmount(amountStr: string): { value: number; hadCommas: boolean; hadExcessPrecision: boolean } {
  const cleaned = amountStr.replace(/,/g, "");
  const hadCommas = cleaned !== amountStr;
  const value = parseFloat(cleaned);
  const hadExcessPrecision = cleaned.includes(".") && cleaned.split(".")[1].length > 2;
  return { value, hadCommas, hadExcessPrecision };
}

// ─── SPLIT DETAILS PARSING ─────────────────────────────────────────

function parseSplitDetails(
  detailsStr: string,
  splitType: string
): Record<string, number> {
  const result: Record<string, number> = {};
  if (!detailsStr || !detailsStr.trim()) return result;

  const parts = detailsStr.split(";").map((p) => p.trim());
  for (const part of parts) {
    // "Aisha 30%" or "Aisha 700" or "Aisha 1"
    const match = part.match(/^(.+?)\s+([\d.]+)%?$/);
    if (match) {
      const name = match[1].trim();
      const value = parseFloat(match[2]);
      result[name] = value;
    }
  }
  return result;
}

// ─── NAME NORMALIZATION ────────────────────────────────────────────

function normalizeName(name: string): { normalized: string; wasVariant: boolean } {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  if (NAME_VARIANTS[lower]) {
    return { normalized: NAME_VARIANTS[lower], wasVariant: trimmed !== NAME_VARIANTS[lower] };
  }

  // Title case fallback
  const titleCase = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  if (KNOWN_MEMBERS.includes(titleCase)) {
    return { normalized: titleCase, wasVariant: trimmed !== titleCase };
  }

  return { normalized: trimmed, wasVariant: false };
}

// ─── MAIN IMPORT FUNCTION ──────────────────────────────────────────

export function processCSVRows(rawRows: RawCSVRow[]): ImportResult {
  const anomalies: ImportAnomaly[] = [];
  let anomalyCounter = 0;

  const createAnomaly = (
    row: number,
    type: AnomalyType,
    severity: "error" | "warning" | "info",
    description: string,
    originalData: string,
    suggestedAction: SuggestedAction,
    extras?: Partial<ImportAnomaly>
  ): ImportAnomaly => {
    const anomaly: ImportAnomaly = {
      id: `anomaly-${++anomalyCounter}`,
      csvRow: row,
      anomalyType: type,
      severity,
      description,
      originalData,
      suggestedAction,
      userApproved: suggestedAction === "auto_fixed" || suggestedAction === "keep_as_is",
      ...extras,
    };
    anomalies.push(anomaly);
    return anomaly;
  };

  // ── PASS 1: Parse all rows ────────────────────────────────────────

  const parsedExpenses: ParsedExpense[] = rawRows.map((raw) => {
    const rowAnomalies: ImportAnomaly[] = [];
    let skip = false;
    const rowJson = JSON.stringify(raw);

    // --- Date Parsing ---
    const dateResult = parseDate(raw.date);
    if (!dateResult.date) {
      rowAnomalies.push(
        createAnomaly(raw.rowIndex, "format_issue", "error",
          `Cannot parse date: "${raw.date}"`, rowJson, "flag_for_review",
          { field: "date" })
      );
    } else if (dateResult.isAmbiguous) {
      rowAnomalies.push(
        createAnomaly(raw.rowIndex, "ambiguous_date", "error",
          `Ambiguous date "${raw.date}": ${dateResult.ambiguityNote}`,
          rowJson, "flag_for_review",
          { field: "date", autoFixValue: dateResult.date.toISOString().split("T")[0] })
      );
    } else if (dateResult.format === "DD/MM/YYYY") {
      rowAnomalies.push(
        createAnomaly(raw.rowIndex, "format_issue", "info",
          `Date "${raw.date}" parsed as DD/MM/YYYY → ${dateResult.date.toISOString().split("T")[0]}`,
          rowJson, "auto_fixed",
          { field: "date", autoFixValue: dateResult.date.toISOString().split("T")[0] })
      );
    } else if (dateResult.format === "Mon DD (no year)") {
      rowAnomalies.push(
        createAnomaly(raw.rowIndex, "format_issue", "info",
          `Incomplete date "${raw.date}" — assumed year 2026 → ${dateResult.date.toISOString().split("T")[0]}`,
          rowJson, "auto_fixed",
          { field: "date", autoFixValue: dateResult.date.toISOString().split("T")[0] })
      );
    }

    // --- Amount Parsing ---
    const amountResult = parseAmount(raw.amount);
    if (isNaN(amountResult.value)) {
      rowAnomalies.push(
        createAnomaly(raw.rowIndex, "invalid_amount", "error",
          `Cannot parse amount: "${raw.amount}"`, rowJson, "flag_for_review",
          { field: "amount" })
      );
    }
    if (amountResult.hadCommas) {
      rowAnomalies.push(
        createAnomaly(raw.rowIndex, "format_issue", "info",
          `Amount "${raw.amount}" contains comma formatting → parsed as ${amountResult.value}`,
          rowJson, "auto_fixed",
          { field: "amount", autoFixValue: String(amountResult.value) })
      );
    }
    if (amountResult.hadExcessPrecision) {
      const rounded = Math.round(amountResult.value * 100) / 100;
      rowAnomalies.push(
        createAnomaly(raw.rowIndex, "precision_issue", "info",
          `Amount ${amountResult.value} has excessive precision → rounded to ${rounded}`,
          rowJson, "auto_fixed",
          { field: "amount", autoFixValue: String(rounded) })
      );
    }
    if (amountResult.value === 0 && !isNaN(amountResult.value)) {
      rowAnomalies.push(
        createAnomaly(raw.rowIndex, "zero_amount", "warning",
          `Amount is ₹0 — "${raw.description}". ${raw.notes ? `Note: "${raw.notes}"` : ""}`,
          rowJson, "skip_row",
          { field: "amount" })
      );
      skip = true;
    }
    if (amountResult.value < 0) {
      rowAnomalies.push(
        createAnomaly(raw.rowIndex, "negative_amount", "info",
          `Negative amount ${amountResult.value} — treating as refund/credit. ${raw.notes ? `Note: "${raw.notes}"` : ""}`,
          rowJson, "keep_as_is",
          { field: "amount" })
      );
    }

    // --- Payer Name ---
    let paidBy = raw.paid_by?.trim() || "";
    if (!paidBy) {
      rowAnomalies.push(
        createAnomaly(raw.rowIndex, "missing_data", "error",
          `Missing payer for "${raw.description}" (₹${amountResult.value})`,
          rowJson, "flag_for_review",
          { field: "paid_by" })
      );
    } else {
      const nameResult = normalizeName(paidBy);
      if (nameResult.wasVariant) {
        rowAnomalies.push(
          createAnomaly(raw.rowIndex, "name_mismatch", nameResult.normalized === paidBy ? "info" : "warning",
            `Payer name "${paidBy}" normalized to "${nameResult.normalized}"`,
            rowJson, "auto_fixed",
            { field: "paid_by", autoFixValue: nameResult.normalized })
        );
      }
      paidBy = nameResult.normalized;

      if (!KNOWN_MEMBERS.includes(paidBy)) {
        rowAnomalies.push(
          createAnomaly(raw.rowIndex, "unknown_member", "warning",
            `Unknown payer: "${paidBy}"`, rowJson, "flag_for_review",
            { field: "paid_by" })
        );
      }
    }

    // --- Currency ---
    let currency = raw.currency?.trim().toUpperCase() || "";
    if (!currency) {
      rowAnomalies.push(
        createAnomaly(raw.rowIndex, "missing_data", "warning",
          `Missing currency for "${raw.description}" — defaulting to INR`,
          rowJson, "auto_fixed",
          { field: "currency", autoFixValue: "INR" })
      );
      currency = "INR";
    }

    // --- Split Type & Settlement Detection ---
    let splitType = raw.split_type?.trim().toLowerCase() || "";
    let isSettlement = false;

    // Detect settlements
    const settlementKeywords = ["paid back", "settlement", "deposit", "repaid", "returned"];
    const descLower = raw.description.toLowerCase();
    const notesLower = (raw.notes || "").toLowerCase();

    if (
      settlementKeywords.some((k) => descLower.includes(k) || notesLower.includes(k)) ||
      (!splitType && raw.split_with && raw.split_with.split(";").length === 1)
    ) {
      isSettlement = true;
      rowAnomalies.push(
        createAnomaly(raw.rowIndex, "misclassified", "warning",
          `"${raw.description}" appears to be a settlement/payment, not a group expense. ${raw.notes ? `Note: "${raw.notes}"` : ""}`,
          rowJson, "convert_to_settlement",
          { field: "split_type" })
      );
    }

    if (!splitType && !isSettlement) {
      rowAnomalies.push(
        createAnomaly(raw.rowIndex, "missing_data", "warning",
          `Missing split type for "${raw.description}"`,
          rowJson, "flag_for_review",
          { field: "split_type" })
      );
    }

    // --- Split With (participants) ---
    const splitWithRaw = raw.split_with
      ? raw.split_with.split(";").map((n) => n.trim()).filter(Boolean)
      : [];

    const splitWith: string[] = [];
    for (const name of splitWithRaw) {
      const nameResult = normalizeName(name);
      if (nameResult.wasVariant && name !== paidBy) {
        // Only log if we haven't already logged for payer
        rowAnomalies.push(
          createAnomaly(raw.rowIndex, "name_mismatch", "info",
            `Participant name "${name}" normalized to "${nameResult.normalized}"`,
            rowJson, "auto_fixed",
            { field: "split_with" })
        );
      }

      if (!KNOWN_MEMBERS.includes(nameResult.normalized) && !nameResult.normalized.includes("friend")) {
        // Unknown participant but not a guest reference
      }

      if (nameResult.normalized.includes("friend") || nameResult.normalized.includes("Kabir")) {
        rowAnomalies.push(
          createAnomaly(raw.rowIndex, "unknown_member", "warning",
            `Non-member "${name}" included in split. They may be a guest.`,
            rowJson, "flag_for_review",
            { field: "split_with" })
        );
      }

      splitWith.push(nameResult.normalized);
    }

    // --- Split Details ---
    const splitDetails = parseSplitDetails(raw.split_details, splitType);

    // Validate percentage splits
    if (splitType === "percentage") {
      const totalPct = Object.values(splitDetails).reduce((a, b) => a + b, 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        rowAnomalies.push(
          createAnomaly(raw.rowIndex, "invalid_split", "warning",
            `Percentage split totals ${totalPct}% instead of 100% for "${raw.description}"`,
            rowJson, "flag_for_review",
            { field: "split_details", autoFixValue: `Normalized to 100%: ${JSON.stringify(normalizePercentages(splitDetails))}` })
        );
      }
    }

    // Validate unequal splits
    if (splitType === "unequal") {
      const totalSplit = Object.values(splitDetails).reduce((a, b) => a + b, 0);
      if (Math.abs(totalSplit - amountResult.value) > 0.01) {
        rowAnomalies.push(
          createAnomaly(raw.rowIndex, "invalid_split", "warning",
            `Unequal split totals ₹${totalSplit} but expense is ₹${amountResult.value}`,
            rowJson, "flag_for_review",
            { field: "split_details" })
        );
      }
    }

    // Check for conflicting split info (equal type with share details)
    if (splitType === "equal" && Object.keys(splitDetails).length > 0) {
      const values = Object.values(splitDetails);
      const allSame = values.every((v) => v === values[0]);
      if (allSame) {
        rowAnomalies.push(
          createAnomaly(raw.rowIndex, "conflicting_data", "info",
            `Split type is "equal" but share details provided (all equal: ${values[0]}). Treating as equal split.`,
            rowJson, "auto_fixed",
            { field: "split_type" })
        );
      } else {
        rowAnomalies.push(
          createAnomaly(raw.rowIndex, "conflicting_data", "warning",
            `Split type is "equal" but shares are unequal: ${JSON.stringify(splitDetails)}. Using shares instead.`,
            rowJson, "flag_for_review",
            { field: "split_type" })
        );
        splitType = "share";
      }
    }

    // --- Membership Violations ---
    if (dateResult.date && !isSettlement) {
      for (const member of splitWith) {
        const normalizedMember = normalizeName(member).normalized;
        const membership = MEMBERSHIP_PERIODS[normalizedMember];
        if (membership) {
          const expDate = dateResult.date;
          const joinDate = new Date(membership.joined);
          const leftDate = membership.left ? new Date(membership.left) : null;

          if (expDate < joinDate) {
            rowAnomalies.push(
              createAnomaly(raw.rowIndex, "membership_violation", "warning",
                `"${normalizedMember}" is in the split but hadn't joined yet (joined ${membership.joined}, expense date ${dateResult.date.toISOString().split("T")[0]})`,
                rowJson, "flag_for_review",
                { field: "split_with" })
            );
          }

          if (leftDate && expDate > leftDate) {
            rowAnomalies.push(
              createAnomaly(raw.rowIndex, "membership_violation", "warning",
                `"${normalizedMember}" is in the split but had already left (left ${membership.left}, expense date ${dateResult.date.toISOString().split("T")[0]})`,
                rowJson, "flag_for_review",
                { field: "split_with" })
            );
          }
        }
      }
    }

    const amount = amountResult.hadExcessPrecision
      ? Math.round(amountResult.value * 100) / 100
      : amountResult.value;

    return {
      rowIndex: raw.rowIndex,
      date: dateResult.date,
      dateString: raw.date,
      description: raw.description,
      paidBy,
      amount,
      currency,
      splitType,
      splitWith,
      splitDetails,
      notes: raw.notes || "",
      isSettlement,
      anomalies: rowAnomalies,
      skip,
    };
  });

  // ── PASS 2: Cross-row checks (duplicates) ─────────────────────────

  for (let i = 0; i < parsedExpenses.length; i++) {
    for (let j = i + 1; j < parsedExpenses.length; j++) {
      const a = parsedExpenses[i];
      const b = parsedExpenses[j];

      if (a.skip || b.skip) continue;
      if (!a.date || !b.date) continue;

      // Same date, similar description, same payer
      const sameDate = a.date.getTime() === b.date.getTime();
      const samePayer = a.paidBy === b.paidBy;
      const sameAmount = a.amount === b.amount;
      const similarDesc = descriptionSimilarity(a.description, b.description) > 0.5;

      if (sameDate && samePayer && sameAmount && similarDesc) {
        // Exact duplicate
        createAnomaly(b.rowIndex, "duplicate", "warning",
          `Likely duplicate of row ${a.rowIndex}: "${a.description}" — same date, payer, and amount`,
          JSON.stringify({ row_a: a.rowIndex, row_b: b.rowIndex }),
          "skip_row",
          { relatedRows: [a.rowIndex] }
        );
        b.skip = true;
      } else if (sameDate && similarDesc && !samePayer && a.amount !== b.amount) {
        // Same event, different loggers (Thalassa case)
        const noteHint = a.notes.toLowerCase().includes("wrong") || b.notes.toLowerCase().includes("wrong");
        createAnomaly(b.rowIndex, "duplicate_conflict", "error",
          `Conflicting entries for same event: Row ${a.rowIndex} "${a.description}" (${a.paidBy}: ₹${a.amount}) vs Row ${b.rowIndex} "${b.description}" (${b.paidBy}: ₹${b.amount})${noteHint ? " — notes suggest one is incorrect" : ""}`,
          JSON.stringify({ row_a: a.rowIndex, row_b: b.rowIndex }),
          "flag_for_review",
          { relatedRows: [a.rowIndex] }
        );
      }
    }
  }

  // ── COMPUTE SUMMARY ────────────────────────────────────────────────

  const importedCount = parsedExpenses.filter((e) => !e.skip).length;
  const skippedCount = parsedExpenses.filter((e) => e.skip).length;
  const flaggedCount = anomalies.filter((a) => a.suggestedAction === "flag_for_review").length;

  return {
    totalRows: rawRows.length,
    parsedExpenses,
    anomalies,
    importedCount,
    skippedCount,
    flaggedCount,
  };
}

// ─── HELPER: Description similarity ────────────────────────────────

function descriptionSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).sort();
  const wordsA = normalize(a);
  const wordsB = normalize(b);
  const intersection = wordsA.filter((w) => wordsB.includes(w));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.length / union.size;
}

// ─── HELPER: Normalize percentages ─────────────────────────────────

function normalizePercentages(
  details: Record<string, number>
): Record<string, number> {
  const total = Object.values(details).reduce((a, b) => a + b, 0);
  const normalized: Record<string, number> = {};
  for (const [name, pct] of Object.entries(details)) {
    normalized[name] = Math.round((pct / total) * 10000) / 100;
  }
  return normalized;
}

// ─── BALANCE CALCULATION ───────────────────────────────────────────

export interface BalanceEntry {
  from: string;
  to: string;
  amount: number; // in INR
}

export interface MemberBalance {
  name: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number; // positive = owed by others, negative = owes others
}

export function calculateBalances(expenses: ParsedExpense[]): {
  memberBalances: MemberBalance[];
  simplifiedDebts: BalanceEntry[];
  pairwiseBalances: Record<string, Record<string, number>>;
} {
  // Track net balance per person: positive = others owe them, negative = they owe others
  const netBalances: Record<string, number> = {};
  const totalPaid: Record<string, number> = {};
  const totalOwed: Record<string, number> = {};

  // Pairwise tracking: pairwise[A][B] = amount A owes B
  const pairwise: Record<string, Record<string, number>> = {};

  const ensurePerson = (name: string) => {
    if (!(name in netBalances)) netBalances[name] = 0;
    if (!(name in totalPaid)) totalPaid[name] = 0;
    if (!(name in totalOwed)) totalOwed[name] = 0;
    if (!(name in pairwise)) pairwise[name] = {};
  };

  for (const expense of expenses) {
    if (expense.skip || !expense.date) continue;

    // Handle settlements
    if (expense.isSettlement) {
      const from = expense.paidBy;
      const to = expense.splitWith[0];
      if (from && to) {
        ensurePerson(from);
        ensurePerson(to);
        const amountInr = expense.currency === "USD"
          ? expense.amount * USD_TO_INR
          : expense.amount;
        // Settlement: from paid to, reducing from's debt to to
        netBalances[from] += amountInr;
        netBalances[to] -= amountInr;
        pairwise[from] = pairwise[from] || {};
        pairwise[from][to] = (pairwise[from][to] || 0) - amountInr;
      }
      continue;
    }

    const payer = expense.paidBy;
    if (!payer) continue;

    ensurePerson(payer);

    const amountInr = expense.currency === "USD"
      ? expense.amount * USD_TO_INR
      : expense.amount;

    totalPaid[payer] += amountInr;

    // Calculate each person's share
    const shares = calculateShares(expense, amountInr);

    for (const [person, share] of Object.entries(shares)) {
      ensurePerson(person);
      totalOwed[person] += share;

      if (person !== payer) {
        // person owes payer this share amount
        pairwise[person] = pairwise[person] || {};
        pairwise[person][payer] = (pairwise[person][payer] || 0) + share;
      }
    }
  }

  // Calculate net balances
  for (const person of Object.keys(netBalances)) {
    netBalances[person] += totalPaid[person] - totalOwed[person];
  }

  const memberBalances: MemberBalance[] = Object.keys(netBalances)
    .map((name) => ({
      name,
      totalPaid: Math.round(totalPaid[name] * 100) / 100,
      totalOwed: Math.round(totalOwed[name] * 100) / 100,
      netBalance: Math.round(netBalances[name] * 100) / 100,
    }))
    .sort((a, b) => b.netBalance - a.netBalance);

  // Simplify debts
  const simplifiedDebts = simplifyDebts(netBalances);

  return { memberBalances, simplifiedDebts, pairwiseBalances: pairwise };
}

export function calculateShares(
  expense: ParsedExpense,
  amountInr: number
): Record<string, number> {
  const shares: Record<string, number> = {};
  const participants = expense.splitWith;

  if (participants.length === 0) return shares;

  switch (expense.splitType) {
    case "equal": {
      const perPerson = amountInr / participants.length;
      for (const p of participants) {
        shares[normalizeName(p).normalized] = Math.round(perPerson * 100) / 100;
      }
      break;
    }
    case "unequal": {
      // Use split_details amounts directly
      for (const [name, amount] of Object.entries(expense.splitDetails)) {
        const normalized = normalizeName(name).normalized;
        const shareInr = expense.currency === "USD" ? amount * USD_TO_INR : amount;
        shares[normalized] = Math.round(shareInr * 100) / 100;
      }
      break;
    }
    case "percentage": {
      const totalPct = Object.values(expense.splitDetails).reduce((a, b) => a + b, 0);
      for (const [name, pct] of Object.entries(expense.splitDetails)) {
        const normalized = normalizeName(name).normalized;
        // Normalize if percentages don't add to 100
        const effectivePct = totalPct !== 100 ? (pct / totalPct) * 100 : pct;
        shares[normalized] = Math.round((amountInr * effectivePct) / 10000) * 100 / 100;
        shares[normalized] = Math.round((amountInr * effectivePct / 100) * 100) / 100;
      }
      break;
    }
    case "share": {
      const totalUnits = Object.values(expense.splitDetails).reduce((a, b) => a + b, 0);
      if (totalUnits > 0) {
        for (const [name, units] of Object.entries(expense.splitDetails)) {
          const normalized = normalizeName(name).normalized;
          shares[normalized] = Math.round((amountInr * units / totalUnits) * 100) / 100;
        }
      }
      break;
    }
    default: {
      // Fallback to equal split
      const perPerson = amountInr / participants.length;
      for (const p of participants) {
        shares[normalizeName(p).normalized] = Math.round(perPerson * 100) / 100;
      }
    }
  }

  return shares;
}

// ─── DEBT SIMPLIFICATION ──────────────────────────────────────────

function simplifyDebts(netBalances: Record<string, number>): BalanceEntry[] {
  const debts: BalanceEntry[] = [];

  // Separate into creditors (positive balance) and debtors (negative balance)
  const creditors: { name: string; amount: number }[] = [];
  const debtors: { name: string; amount: number }[] = [];

  for (const [name, balance] of Object.entries(netBalances)) {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded > 0.01) {
      creditors.push({ name, amount: rounded });
    } else if (rounded < -0.01) {
      debtors.push({ name, amount: -rounded }); // store as positive
    }
  }

  // Sort: largest first
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  // Greedy matching
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const payment = Math.min(debtors[i].amount, creditors[j].amount);
    if (payment > 0.01) {
      debts.push({
        from: debtors[i].name,
        to: creditors[j].name,
        amount: Math.round(payment * 100) / 100,
      });
    }
    debtors[i].amount -= payment;
    creditors[j].amount -= payment;

    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  return debts;
}
