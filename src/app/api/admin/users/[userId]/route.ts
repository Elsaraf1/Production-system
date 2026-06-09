import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";

const patchSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/admin/users/[userId]">
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return new Response(null, { status: 403 });

  const { userId } = await ctx.params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return new Response(null, { status: 404 });

  const passwordHash = await hash(parsed.data.password, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return new Response(null, { status: 204 });
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/admin/users/[userId]">
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return new Response(null, { status: 403 });

  const { userId } = await ctx.params;

  // Cannot delete yourself
  if (userId === session.user.id) {
    return Response.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return new Response(null, { status: 404 });

  // Soft delete — deactivate rather than hard delete to preserve audit trail
  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });

  return new Response(null, { status: 204 });
}
