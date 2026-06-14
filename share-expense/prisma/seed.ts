/**
 * Database Seed Script
 *
 * Pre-creates the 6 flatmate users, the "Flatmates" group, and sets up
 * membership periods based on the CSV narrative:
 * - Aisha, Rohan, Priya: Feb 1, 2026 → ongoing
 * - Meera: Feb 1, 2026 → Mar 31, 2026 (moved out)
 * - Dev: Feb 8, 2026 → Mar 14, 2026 (trip guest)
 * - Sam: Apr 8, 2026 → ongoing (moved in mid-April)
 */

import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data (in correct order to respect FK constraints)
  await prisma.importAnomaly.deleteMany();
  await prisma.importReport.deleteMany();
  await prisma.expenseSplit.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.groupMembership.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();

  console.log("  ✓ Cleared existing data");

  // Create users
  const password = hashSync("password123", 10);

  const users = await Promise.all([
    prisma.user.create({
      data: { name: "Aisha", email: "aisha@shareexpense.app", passwordHash: password },
    }),
    prisma.user.create({
      data: { name: "Rohan", email: "rohan@shareexpense.app", passwordHash: password },
    }),
    prisma.user.create({
      data: { name: "Priya", email: "priya@shareexpense.app", passwordHash: password },
    }),
    prisma.user.create({
      data: { name: "Meera", email: "meera@shareexpense.app", passwordHash: password },
    }),
    prisma.user.create({
      data: { name: "Dev", email: "dev@shareexpense.app", passwordHash: password },
    }),
    prisma.user.create({
      data: { name: "Sam", email: "sam@shareexpense.app", passwordHash: password },
    }),
  ]);

  console.log(`  ✓ Created ${users.length} users: ${users.map((u) => u.name).join(", ")}`);

  const userMap: Record<string, number> = {};
  users.forEach((u) => { userMap[u.name] = u.id; });

  // Create group
  const group = await prisma.group.create({
    data: {
      name: "Flatmates",
      description: "Shared flat expenses — rent, utilities, groceries, and outings",
      createdById: userMap["Aisha"],
    },
  });

  console.log(`  ✓ Created group: "${group.name}" (ID: ${group.id})`);

  // Create memberships with timeline
  const memberships = [
    { userId: userMap["Aisha"], joinedAt: "2026-02-01", leftAt: null, role: "admin" },
    { userId: userMap["Rohan"], joinedAt: "2026-02-01", leftAt: null, role: "member" },
    { userId: userMap["Priya"], joinedAt: "2026-02-01", leftAt: null, role: "member" },
    { userId: userMap["Meera"], joinedAt: "2026-02-01", leftAt: "2026-03-31", role: "member" },
    { userId: userMap["Dev"],   joinedAt: "2026-02-08", leftAt: "2026-03-14", role: "member" },
    { userId: userMap["Sam"],   joinedAt: "2026-04-08", leftAt: null, role: "member" },
  ];

  for (const m of memberships) {
    await prisma.groupMembership.create({
      data: {
        groupId: group.id,
        userId: m.userId,
        joinedAt: new Date(m.joinedAt),
        leftAt: m.leftAt ? new Date(m.leftAt) : null,
        role: m.role,
      },
    });
  }

  console.log(`  ✓ Created ${memberships.length} memberships with timeline data`);
  console.log("");
  console.log("📋 Membership Timeline:");
  console.log("  Aisha  : Feb 01, 2026 → Active (admin)");
  console.log("  Rohan  : Feb 01, 2026 → Active");
  console.log("  Priya  : Feb 01, 2026 → Active");
  console.log("  Meera  : Feb 01, 2026 → Mar 31, 2026 (moved out)");
  console.log("  Dev    : Feb 08, 2026 → Mar 14, 2026 (trip guest)");
  console.log("  Sam    : Apr 08, 2026 → Active (moved in)");
  console.log("");
  console.log("✅ Seed complete! Now import the CSV through the app.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
