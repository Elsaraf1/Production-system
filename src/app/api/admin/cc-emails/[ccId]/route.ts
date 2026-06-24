import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ ccId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return new Response(null, { status: 403 });

  const { ccId } = await ctx.params;
  const row = await prisma.ccEmail.findUnique({ where: { id: ccId } });
  if (!row) return new Response(null, { status: 404 });

  await prisma.ccEmail.delete({ where: { id: ccId } });
  return new Response(null, { status: 204 });
}
