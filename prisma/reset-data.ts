import { config } from "dotenv";
config({ path: ".env.local" });
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Deleting all order data...");
  await prisma.auditLog.deleteMany();
  await prisma.note.deleteMany();
  await prisma.purchaseRequisition.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.salesOrder.deleteMany();
  console.log("Done — all orders, items, PRs, notes and audit logs deleted. Users kept.");
}

main()
  .catch(console.error)
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
