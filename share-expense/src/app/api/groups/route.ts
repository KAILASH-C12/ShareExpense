import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/groups — list groups for user
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");

  const groups = await prisma.group.findMany({
    where: userId
      ? { memberships: { some: { userId: parseInt(userId) } } }
      : undefined,
    include: {
      memberships: {
        include: { user: true },
        orderBy: { joinedAt: "asc" },
      },
      _count: { select: { expenses: true } },
    },
  });

  return NextResponse.json(groups);
}

// POST /api/groups — create a new group
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, createdById, members } = body;

    const group = await prisma.group.create({
      data: {
        name,
        description,
        createdById,
        memberships: {
          create: members.map((m: { userId: number; joinedAt: string; leftAt?: string }) => ({
            userId: m.userId,
            joinedAt: new Date(m.joinedAt),
            leftAt: m.leftAt ? new Date(m.leftAt) : null,
          })),
        },
      },
      include: {
        memberships: { include: { user: true } },
      },
    });

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error("Create group error:", error);
    return NextResponse.json(
      { error: "Failed to create group" },
      { status: 500 }
    );
  }
}
