import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";

const createSchema = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(6),
  displayName: z.string().min(1).max(100),
  role: z.enum(["ADMIN", "PRODUCTION", "PLANNER", "TECHNICAL", "PROCUREMENT", "SALES"]),
  department: z.enum(["DRAWING", "CARPENTRY", "PAINTING", "UPHOLSTERY", "PACKING", "PR_CREATION"]).nullable().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return new Response(null, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (existing) return Response.json({ error: "Username already taken" }, { status: 409 });

  const passwordHash = await hash(parsed.data.password, 12);
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        username: parsed.data.username,
        passwordHash,
        displayName: parsed.data.displayName,
        role: parsed.data.role,
        department: parsed.data.department ?? null,
        email: parsed.data.email || null,
        isActive: true,
      },
    });
    await writeAuditLog(tx, {
      userId: session.user.id, entityType: "USER", entityId: u.id,
      action: "CREATE", newValue: u.username,
    });
    return u;
  });

  return Response.json({ id: user.id, username: user.username }, { status: 201 });
}
