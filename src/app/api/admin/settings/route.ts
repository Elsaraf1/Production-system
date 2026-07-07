import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

const DEFAULT_THRESHOLDS = { drawing: 7, carpentry: 7, painting: 7, upholstery: 7, packing: 7, procurement: 10 };

export async function GET() {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });
  if (session.user.role !== "ADMIN") return new Response(null, { status: 403 });

  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: "overdue_thresholds" } });
    const thresholds = setting
      ? { ...DEFAULT_THRESHOLDS, ...JSON.parse(setting.value) }
      : { ...DEFAULT_THRESHOLDS };
    return Response.json({ thresholds });
  } catch {
    return Response.json({ thresholds: DEFAULT_THRESHOLDS });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });
  if (session.user.role !== "ADMIN") return new Response(null, { status: 403 });

  try {
    const { key, value } = await req.json();
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
