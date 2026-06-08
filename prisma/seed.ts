import { config } from "dotenv";
config({ path: ".env.local" });
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hash } from "bcryptjs";

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminHash = await hash("admin123", 12);

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: adminHash,
      displayName: "Administrator",
      role: "ADMIN",
      department: null,
      isActive: true,
    },
  });

  const order = await prisma.salesOrder.upsert({
    where: { ppoNumber: "PPO-12008375" },
    update: {},
    create: {
      ppoNumber: "PPO-12008375",
      clientName: "Al Futtaim Interiors",
      orderDate: new Date("2026-01-15"),
      rsd: new Date("2026-06-30"),
    },
  });

  await prisma.orderItem.createMany({
    skipDuplicates: true,
    data: [
      {
        salesOrderId: order.id,
        itemCode: "CHR-001",
        description: "Dining Chair - Oak",
        productionOrderNo: "PO-88001",
        outstandingQty: 12,
        sortOrder: 1,
      },
      {
        salesOrderId: order.id,
        itemCode: "TBL-002",
        description: "Coffee Table - Marble Top",
        productionOrderNo: "PO-88002",
        outstandingQty: 4,
        sortOrder: 2,
      },
    ],
  });

  console.log("Seed complete — admin / admin123");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
