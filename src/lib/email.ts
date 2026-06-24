import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM ?? "Production Dashboard <onboarding@resend.dev>";
const BASE_URL = process.env.NEXTAUTH_URL ?? "https://production-system-pi.vercel.app";

async function send(to: string[], subject: string, html: string): Promise<void> {
  if (!to.length || !process.env.RESEND_API_KEY) return;
  await resend.emails.send({ from: FROM, to, subject, html });
}

function wrap(title: string, body: string): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
<p style="color:#888;font-size:12px;margin-bottom:16px">Production Dashboard — Batal Furniture</p>
<h2 style="margin:0 0 16px;font-size:20px">${title}</h2>
${body}
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="color:#888;font-size:12px"><a href="${BASE_URL}" style="color:#2563eb;text-decoration:none">Open Dashboard →</a></p>
</body></html>`;
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:5px 0;color:#666;width:150px;vertical-align:top">${label}</td><td style="padding:5px 0;font-weight:600">${value}</td></tr>`;
}

function table(...rows: string[]): string {
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:16px">${rows.join("")}</table>`;
}

// Maps each stage to the next stage's label and department for notifications
export const NEXT_STAGE_NOTIFY: Record<string, { stage: string; department: string } | null> = {
  drawing:    { stage: "Carpentry",   department: "CARPENTRY" },
  carpentry:  { stage: "Painting",    department: "PAINTING" },
  painting:   { stage: "Upholstery",  department: "UPHOLSTERY" },
  upholstery: { stage: "Packing",     department: "PACKING" },
  packing:    null,
};

export async function notifyOrderCreated(
  order: { ppoNumber: string; clientName: string; rsd: Date },
  emails: string[]
): Promise<void> {
  const rsdStr = new Date(order.rsd).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  await send(
    emails,
    `New Order: ${order.ppoNumber} — ${order.clientName}`,
    wrap("New order created", table(
      row("PPO Number", order.ppoNumber),
      row("Client", order.clientName),
      row("Required Ship Date", rsdStr),
    ) + `<p style="color:#555">Please review the order and begin the drawing / releasing process.</p>`)
  );
}

export async function notifyMaterialRequested(
  item: { itemCode: string; ppoNumber: string },
  material: string,
  emails: string[]
): Promise<void> {
  await send(
    emails,
    `Material Requested: ${material} — ${item.ppoNumber}`,
    wrap("Material requested", table(
      row("PPO Number", item.ppoNumber),
      row("Item Code", item.itemCode),
      row("Material", material),
    ) + `<p style="color:#555">Please proceed with sourcing and procurement.</p>`)
  );
}

export async function notifyBulkMaterialRequested(count: number, emails: string[]): Promise<void> {
  await send(
    emails,
    `${count} Material Request${count !== 1 ? "s" : ""} Submitted via Import`,
    wrap("Bulk material request", `
      <p><strong>${count}</strong> material request${count !== 1 ? "s were" : " was"} submitted via Excel import.</p>
      <p style="color:#555;margin-top:8px">Please open the Procurement page in the dashboard to review and action them.</p>
    `)
  );
}

export async function notifyMaterialReceived(
  item: { itemCode: string; ppoNumber: string },
  material: string,
  emails: string[]
): Promise<void> {
  await send(
    emails,
    `Material Arrived: ${material} — ${item.ppoNumber}`,
    wrap("Material received", table(
      row("PPO Number", item.ppoNumber),
      row("Item Code", item.itemCode),
      row("Material", material),
    ) + `<p style="color:#555">The material has arrived and is ready for use in production.</p>`)
  );
}

export async function notifyBulkMaterialReceived(count: number, emails: string[]): Promise<void> {
  await send(
    emails,
    `${count} Material${count !== 1 ? "s" : ""} Marked as Received`,
    wrap("Bulk materials received", `
      <p><strong>${count}</strong> material${count !== 1 ? "s have" : " has"} been marked as received via Excel import.</p>
      <p style="color:#555;margin-top:8px">Check the relevant orders — production can proceed for items with all materials arrived.</p>
    `)
  );
}

export async function notifyStageDone(
  item: { itemCode: string; ppoNumber: string },
  completedStage: string,
  nextStage: string,
  emails: string[]
): Promise<void> {
  const stageName = completedStage.charAt(0).toUpperCase() + completedStage.slice(1);
  await send(
    emails,
    `${stageName} Done — ${item.ppoNumber} (${item.itemCode}) ready for ${nextStage}`,
    wrap(`${stageName} stage completed`, table(
      row("PPO Number", item.ppoNumber),
      row("Item Code", item.itemCode),
      row("Completed Stage", stageName),
      row("Next Stage", `<span style="color:#2563eb">${nextStage}</span>`),
    ) + `<p style="color:#555">This item is now ready for the <strong>${nextStage}</strong> stage.</p>`)
  );
}
