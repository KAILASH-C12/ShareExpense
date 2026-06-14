import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { ParsedExpense, ImportAnomaly } from "@/lib/import-engine";

const USD_TO_INR = 83.5;

interface ConfirmImportBody {
  groupId: number;
  userId: number;
  filename: string;
  expenses: ParsedExpense[];
  anomalies: ImportAnomaly[];
}

export async function POST(request: NextRequest) {
  try {
    const body: ConfirmImportBody = await request.json();
    const { groupId, userId, filename, expenses, anomalies } = body;

    // Fetch user mapping
    const users = await prisma.user.findMany();
    const userMap: Record<string, number> = {};
    for (const u of users) {
      userMap[u.name.toLowerCase()] = u.id;
    }

    // Create import report
    const importReport = await prisma.importReport.create({
      data: {
        groupId,
        filename,
        totalRows: expenses.length,
        importedOk: expenses.filter((e) => !e.skip).length,
        anomaliesFound: anomalies.length,
        skipped: expenses.filter((e) => e.skip).length,
        importedById: userId,
        anomalies: {
          create: anomalies.map((a) => ({
            csvRow: a.csvRow,
            anomalyType: a.anomalyType,
            severity: a.severity,
            description: a.description,
            originalData: a.originalData,
            actionTaken: a.suggestedAction,
            resolutionDetails: a.autoFixValue || null,
            userApproved: a.userApproved,
          })),
        },
      },
    });

    // Import expenses
    let importedCount = 0;
    let settlementCount = 0;

    for (const exp of expenses) {
      if (exp.skip || !exp.date) continue;

      const payerName = exp.paidBy.toLowerCase();
      const payerId = userMap[payerName];

      if (!payerId) {
        console.warn(`Skipping row ${exp.rowIndex}: unknown payer "${exp.paidBy}"`);
        continue;
      }

      if (exp.isSettlement) {
        // Import as settlement
        const toName = exp.splitWith[0]?.toLowerCase();
        const toId = toName ? userMap[toName] : null;

        if (toId) {
          await prisma.settlement.create({
            data: {
              groupId,
              fromUserId: payerId,
              toUserId: toId,
              amount: Math.abs(exp.amount),
              currency: exp.currency || "INR",
              settlementDate: new Date(exp.date),
              notes: exp.notes || exp.description,
              importSource: "csv",
              importRow: exp.rowIndex,
            },
          });
          settlementCount++;
        }
        continue;
      }

      // Calculate exchange rate
      const exchangeRate = exp.currency === "USD" ? USD_TO_INR : 1.0;

      // Calculate splits
      const splits = calculateImportSplits(exp, userMap, exchangeRate);

      if (splits.length === 0) {
        console.warn(`Skipping row ${exp.rowIndex}: no valid splits for "${exp.description}"`);
        continue;
      }

      await prisma.expense.create({
        data: {
          groupId,
          paidByUserId: payerId,
          description: exp.description,
          amount: Math.abs(exp.amount),
          currency: exp.currency || "INR",
          exchangeRate,
          splitType: exp.splitType || "equal",
          notes: exp.notes,
          expenseDate: new Date(exp.date),
          isSettlement: false,
          importSource: "csv",
          importRow: exp.rowIndex,
          splits: {
            create: splits,
          },
        },
      });
      importedCount++;
    }

    return NextResponse.json({
      success: true,
      importReportId: importReport.id,
      importedExpenses: importedCount,
      importedSettlements: settlementCount,
      totalAnomalies: anomalies.length,
    });
  } catch (error) {
    console.error("Confirm import error:", error);
    return NextResponse.json(
      { error: "Import confirmation failed", details: String(error) },
      { status: 500 }
    );
  }
}

function calculateImportSplits(
  exp: ParsedExpense,
  userMap: Record<string, number>,
  exchangeRate: number
) {
  const splits: {
    userId: number;
    shareAmount: number;
    shareAmountInr: number;
    percentage: number | null;
    shareUnits: number | null;
  }[] = [];

  const amount = Math.abs(exp.amount);
  const amountInr = amount * exchangeRate;
  const participants = exp.splitWith
    .map((n) => ({ name: n, userId: userMap[n.toLowerCase()] }))
    .filter((p) => p.userId);

  if (participants.length === 0) return splits;

  switch (exp.splitType) {
    case "equal": {
      const perPerson = amount / participants.length;
      const perPersonInr = amountInr / participants.length;
      for (const p of participants) {
        splits.push({
          userId: p.userId,
          shareAmount: Math.round(perPerson * 100) / 100,
          shareAmountInr: Math.round(perPersonInr * 100) / 100,
          percentage: null,
          shareUnits: null,
        });
      }
      break;
    }
    case "unequal": {
      for (const p of participants) {
        const detailAmount = exp.splitDetails[p.name] || 0;
        splits.push({
          userId: p.userId,
          shareAmount: detailAmount,
          shareAmountInr: detailAmount * exchangeRate,
          percentage: null,
          shareUnits: null,
        });
      }
      break;
    }
    case "percentage": {
      const totalPct = Object.values(exp.splitDetails).reduce((a, b) => a + b, 0);
      for (const p of participants) {
        const pct = exp.splitDetails[p.name] || 0;
        const effectivePct = totalPct !== 100 && totalPct > 0 ? (pct / totalPct) * 100 : pct;
        const share = (amount * effectivePct) / 100;
        splits.push({
          userId: p.userId,
          shareAmount: Math.round(share * 100) / 100,
          shareAmountInr: Math.round(share * exchangeRate * 100) / 100,
          percentage: Math.round(effectivePct * 100) / 100,
          shareUnits: null,
        });
      }
      break;
    }
    case "share": {
      const totalUnits = Object.values(exp.splitDetails).reduce((a, b) => a + b, 0);
      if (totalUnits > 0) {
        for (const p of participants) {
          const units = exp.splitDetails[p.name] || 0;
          const share = (amount * units) / totalUnits;
          splits.push({
            userId: p.userId,
            shareAmount: Math.round(share * 100) / 100,
            shareAmountInr: Math.round(share * exchangeRate * 100) / 100,
            percentage: null,
            shareUnits: units,
          });
        }
      }
      break;
    }
    default: {
      // Fallback: equal split
      const perPerson = amount / participants.length;
      const perPersonInr = amountInr / participants.length;
      for (const p of participants) {
        splits.push({
          userId: p.userId,
          shareAmount: Math.round(perPerson * 100) / 100,
          shareAmountInr: Math.round(perPersonInr * 100) / 100,
          percentage: null,
          shareUnits: null,
        });
      }
    }
  }

  return splits;
}
