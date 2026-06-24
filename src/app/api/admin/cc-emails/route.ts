import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  email: z.string().email("Invalid email address"),
  label: z.string().max(100).optional().or(z.literal("")),
});

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return new Response(null, { status: 403 });

  const rows = await prisma.ccEmail.findMany({ orderBy: { createdAt: "asc" } });
  return Response.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return new Response(null, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const existing = await prisma.ccEmail.findUnique({ where: { email: parsed.data.email } });
  if (existing) return Response.json({ error: "Email already in CC list" }, { status: 409 });

  const row = await prisma.ccEmail.create({
    data: {
      email: parsed.data.email,
      label: parsed.data.label || null,
    },
  });

  return Response.json(row, { status: 201 });
}
