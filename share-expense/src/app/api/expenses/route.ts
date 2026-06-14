import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/expenses — list all expenses for a group
export async function GET(request: NextRequest) {
  const groupId = request.nextUrl.searchParams.get("groupId");

  if (!groupId) {
    return NextResponse.json({ error: "groupId is required" }, { status: 400 });
  }

  const expenses = await prisma.expense.findMany({
    where: { groupId: parseInt(groupId) },
    include: {
      paidBy: true,
      splits: { include: { user: true } },
    },
    orderBy: { expenseDate: "desc" },
  });

  return NextResponse.json(expenses);
}

// POST /api/expenses — create new expense
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      groupId, paidByUserId, description, amount, currency,
      exchangeRate, splitType, notes, expenseDate, isSettlement,
      splits, importSource, importRow,
    } = body;

    const expense = await prisma.expense.create({
      data: {
        groupId,
        paidByUserId,
        description,
        amount,
        currency: currency || "INR",
        exchangeRate: exchangeRate || 1.0,
        splitType,
        notes,
        expenseDate: new Date(expenseDate),
        isSettlement: isSettlement || false,
        importSource: importSource || "manual",
        importRow,
        splits: {
          create: splits.map((s: { userId: number; shareAmount: number; shareAmountInr: number; percentage?: number; shareUnits?: number }) => ({
            userId: s.userId,
            shareAmount: s.shareAmount,
            shareAmountInr: s.shareAmountInr,
            percentage: s.percentage,
            shareUnits: s.shareUnits,
          })),
        },
      },
      include: {
        paidBy: true,
        splits: { include: { user: true } },
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("Create expense error:", error);
    return NextResponse.json(
      { error: "Failed to create expense", details: String(error) },
      { status: 500 }
    );
  }
}
