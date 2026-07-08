import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";
import { z } from "zod";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/items/[itemId]/notes">) {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });
  const { itemId } = await ctx.params;

  const notes = await prisma.note.findMany({
    where: { orderItemId: itemId, deletedAt: null },
    include: { author: { select: { displayName: true } } },
    orderBy: { createdAt: "asc" },
  });
  return Response.json(notes);
}

const postSchema = z.object({ content: z.string().min(1).max(1000) });

export async function POST(req: NextRequest, ctx: RouteContext<"/api/items/[itemId]/notes">) {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });
  if (!["ADMIN", "GM", "PRODUCTION", "PLANNER", "TECHNICAL", "PROCUREMENT"].includes(session.user.role)) {
    return new Response(null, { status: 403 });
  }
  const { itemId } = await ctx.params;
  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const note = await prisma.$transaction(async (tx) => {
    const n = await tx.note.create({
      data: { orderItemId: itemId, content: parsed.data.content, authorId: session.user.id },
      include: { author: { select: { displayName: true } } },
    });
    await writeAuditLog(tx, {
      userId: session.user.id, entityType: "NOTE", entityId: n.id,
      orderItemId: itemId, action: "CREATE", newValue: parsed.data.content,
    });
    return n;
  });
  return Response.json(note, { status: 201 });
}
