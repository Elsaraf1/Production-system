import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

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
