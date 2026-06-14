import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/settlements — list settlements for a group
export async function GET(request: NextRequest) {
  const groupId = request.nextUrl.searchParams.get("groupId");

  if (!groupId) {
    return NextResponse.json({ error: "groupId required" }, { status: 400 });
  }

  const settlements = await prisma.settlement.findMany({
    where: { groupId: parseInt(groupId) },
    include: {
      from: true,
      to: true,
    },
    orderBy: { settlementDate: "desc" },
  });

  return NextResponse.json(settlements);
}

// POST /api/settlements — record a settlement
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { groupId, fromUserId, toUserId, amount, currency, settlementDate, notes } = body;

    const settlement = await prisma.settlement.create({
      data: {
        groupId,
        fromUserId,
        toUserId,
        amount,
        currency: currency || "INR",
        settlementDate: new Date(settlementDate),
        notes,
        importSource: "manual",
      },
      include: {
        from: true,
        to: true,
      },
    });

    return NextResponse.json(settlement, { status: 201 });
  } catch (error) {
    console.error("Settlement error:", error);
    return NextResponse.json({ error: "Failed to record settlement" }, { status: 500 });
  }
}
