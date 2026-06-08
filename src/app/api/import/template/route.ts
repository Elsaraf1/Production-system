import { auth } from "@/lib/auth";
import { buildFullTemplate } from "@/lib/excel";

export async function GET() {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });

  const buffer = buildFullTemplate();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="import-template.xlsx"',
    },
  });
}
