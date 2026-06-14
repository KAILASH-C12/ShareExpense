import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const USD_TO_INR = 83.5;

// GET /api/balances?groupId=1
export async function GET(request: NextRequest) {
  const groupId = request.nextUrl.searchParams.get("groupId");

  if (!groupId) {
    return NextResponse.json({ error: "groupId required" }, { status: 400 });
  }

  const gid = parseInt(groupId);

  // Fetch all expenses with splits
  const expenses = await prisma.expense.findMany({
    where: { groupId: gid, isSettlement: false },
    include: {
      paidBy: true,
      splits: { include: { user: true } },
    },
  });

  // Fetch all settlements
  const settlements = await prisma.settlement.findMany({
    where: { groupId: gid },
    include: { from: true, to: true },
  });

  // Fetch members
  const memberships = await prisma.groupMembership.findMany({
    where: { groupId: gid },
    include: { user: true },
  });

  // Calculate net balances
  // Net balance: positive means others owe this person (they are owed money)
  //              negative means this person owes others
  const netBalances: Record<number, number> = {};
  const totalPaid: Record<number, number> = {};
  const totalOwed: Record<number, number> = {};
  const userNames: Record<number, string> = {};

  for (const m of memberships) {
    netBalances[m.userId] = 0;
    totalPaid[m.userId] = 0;
    totalOwed[m.userId] = 0;
    userNames[m.userId] = m.user.name;
  }

  // Process expenses
  for (const expense of expenses) {
    const payerId = expense.paidByUserId;
    const exchangeRate = Number(expense.exchangeRate) || 1;

    // Total amount paid (in INR)
    const amountInr = Number(expense.amount) * exchangeRate;

    if (payerId in totalPaid) {
      totalPaid[payerId] += amountInr;
    }

    // Process splits
    for (const split of expense.splits) {
      const shareInr = Number(split.shareAmountInr);
      if (split.userId in totalOwed) {
        totalOwed[split.userId] += shareInr;
      }
    }
  }

  // Process settlements
  for (const s of settlements) {
    const amountInr = s.currency === "USD"
      ? Number(s.amount) * USD_TO_INR
      : Number(s.amount);

    // from paid to: reduces from's debt, increases their net
    if (s.fromUserId in netBalances) {
      netBalances[s.fromUserId] += amountInr;
    }
    if (s.toUserId in netBalances) {
      netBalances[s.toUserId] -= amountInr;
    }
  }

  // Calculate net: paid - owed = net
  for (const userId of Object.keys(netBalances).map(Number)) {
    netBalances[userId] += (totalPaid[userId] || 0) - (totalOwed[userId] || 0);
  }

  // Build member balances
  const memberBalances = Object.keys(netBalances).map(Number).map((userId) => ({
    userId,
    name: userNames[userId] || `User ${userId}`,
    totalPaid: Math.round((totalPaid[userId] || 0) * 100) / 100,
    totalOwed: Math.round((totalOwed[userId] || 0) * 100) / 100,
    netBalance: Math.round(netBalances[userId] * 100) / 100,
  })).sort((a, b) => b.netBalance - a.netBalance);

  // Simplify debts (greedy algorithm)
  const simplifiedDebts = simplifyDebts(netBalances, userNames);

  // Per-expense breakdown for drill-down (Rohan's request)
  const expenseBreakdown = expenses.map((e) => ({
    id: e.id,
    description: e.description,
    date: e.expenseDate,
    paidBy: e.paidBy.name,
    amount: Number(e.amount),
    currency: e.currency,
    exchangeRate: Number(e.exchangeRate),
    splitType: e.splitType,
    splits: e.splits.map((s) => ({
      userId: s.userId,
      userName: s.user.name,
      shareAmount: Number(s.shareAmount),
      shareAmountInr: Number(s.shareAmountInr),
    })),
  }));

  return NextResponse.json({
    memberBalances,
    simplifiedDebts,
    expenseBreakdown,
    settlementCount: settlements.length,
    expenseCount: expenses.length,
  });
}

function simplifyDebts(
  netBalances: Record<number, number>,
  userNames: Record<number, string>
) {
  const debts: { from: string; fromId: number; to: string; toId: number; amount: number }[] = [];

  const creditors: { id: number; name: string; amount: number }[] = [];
  const debtors: { id: number; name: string; amount: number }[] = [];

  for (const [idStr, balance] of Object.entries(netBalances)) {
    const id = Number(idStr);
    const rounded = Math.round(balance * 100) / 100;
    if (rounded > 0.5) {
      creditors.push({ id, name: userNames[id], amount: rounded });
    } else if (rounded < -0.5) {
      debtors.push({ id, name: userNames[id], amount: -rounded });
    }
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const payment = Math.min(debtors[i].amount, creditors[j].amount);
    if (payment > 0.5) {
      debts.push({
        from: debtors[i].name,
        fromId: debtors[i].id,
        to: creditors[j].name,
        toId: creditors[j].id,
        amount: Math.round(payment * 100) / 100,
      });
    }
    debtors[i].amount -= payment;
    creditors[j].amount -= payment;

    if (debtors[i].amount < 0.5) i++;
    if (creditors[j].amount < 0.5) j++;
  }

  return debts;
}
