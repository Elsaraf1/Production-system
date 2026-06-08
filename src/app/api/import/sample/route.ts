import { auth } from "@/lib/auth";
import { buildPlannerSample, buildReleasingSample, buildMaterialSample } from "@/lib/excel";
import { NextRequest } from "next/server";

const configs = {
  planner:          { fn: buildPlannerSample,   name: "sample-planner-import.xlsx" },
  releasing:        { fn: buildReleasingSample, name: "sample-releasing-order.xlsx" },
  "material-request": { fn: buildMaterialSample, name: "sample-material-request.xlsx" },
  "material-receive": { fn: buildMaterialSample, name: "sample-material-receive.xlsx" },
} as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });

  const type = req.nextUrl.searchParams.get("type") as keyof typeof configs | null;
  const config = type ? configs[type] : null;
  if (!config) return Response.json({ error: "Invalid type" }, { status: 400 });

  const buffer = config.fn();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${config.name}"`,
    },
  });
}
