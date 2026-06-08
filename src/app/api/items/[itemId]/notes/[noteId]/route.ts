import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/items/[itemId]/notes/[noteId]">
) {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });
  const { itemId, noteId } = await ctx.params;

  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note || note.deletedAt) return new Response(null, { status: 404 });

  const isAuthor = note.authorId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isAuthor && !isAdmin) return new Response(null, { status: 403 });

  await prisma.$transaction(async (tx) => {
    await tx.note.update({
      where: { id: noteId },
      data: { deletedAt: new Date(), deletedById: session.user.id },
    });
    await writeAuditLog(tx, {
      userId: session.user.id, entityType: "NOTE", entityId: noteId,
      orderItemId: itemId, action: "DELETE", oldValue: note.content,
    });
  });
  return new Response(null, { status: 204 });
}
