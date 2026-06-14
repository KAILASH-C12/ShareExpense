import { NextRequest, NextResponse } from "next/server";
import { processCSVRows } from "@/lib/import-engine";
import type { RawCSVRow } from "@/lib/import-engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { csvText, groupId, userId } = body;

    if (!csvText || !groupId || !userId) {
      return NextResponse.json(
        { error: "Missing csvText, groupId, or userId" },
        { status: 400 }
      );
    }

    // Parse CSV text into rows
    const lines = csvText.split("\n").filter((line: string) => line.trim());
    const headers = lines[0].split(",").map((h: string) => h.trim().toLowerCase());

    const rawRows: RawCSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      // Handle CSV with quoted fields properly
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h: string, idx: number) => {
        row[h] = (values[idx] || "").trim();
      });

      rawRows.push({
        date: row["date"] || "",
        description: row["description"] || "",
        paid_by: row["paid_by"] || "",
        amount: row["amount"] || "",
        currency: row["currency"] || "",
        split_type: row["split_type"] || "",
        split_with: row["split_with"] || "",
        split_details: row["split_details"] || "",
        notes: row["notes"] || "",
        rowIndex: i + 1, // 1-based, accounting for header
      });
    }

    // Process through import engine
    const result = processCSVRows(rawRows);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Import processing failed", details: String(error) },
      { status: 500 }
    );
  }
}

// Simple CSV line parser handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
