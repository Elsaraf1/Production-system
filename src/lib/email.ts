import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

const BASE_URL = process.env.NEXTAUTH_URL ?? "https://production-system-pi.vercel.app";

function getTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

async function send(to: string[], subject: string, html: string): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const ccRows = await prisma.ccEmail.findMany({ select: { email: true } });
  const cc = ccRows.map(r => r.email).filter(e => !to.includes(e));
  const from = `Production Dashboard <${process.env.GMAIL_USER}>`;

  const allTo = [...new Set([...to, ...cc])];
  if (!allTo.length) return;

  await transport.sendMail({ from, to: allTo, subject, html });
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

// Info for each stage (used to look up label + department for any stage)
export const STAGE_INFO: Record<string, { label: string; department: string }> = {
  drawing:    { label: "Drawing",    department: "DRAWING" },
  carpentry:  { label: "Carpentry",  department: "CARPENTRY" },
  painting:   { label: "Painting",   department: "PAINTING" },
  upholstery: { label: "Upholstery", department: "UPHOLSTERY" },
  packing:    { label: "Packing",    department: "PACKING" },
};

export const STAGE_ORDER = ["drawing", "carpentry", "painting", "upholstery", "packing"] as const;

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
  item: { itemCode: string; ppoNumber: string; clientName: string },
  material: string,
  emails: string[]
): Promise<void> {
  await send(
    emails,
    `Material Requested: ${material} — ${item.ppoNumber}`,
    wrap("Material requested", table(
      row("Client", item.clientName),
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
  item: { itemCode: string; ppoNumber: string; clientName: string },
  material: string,
  emails: string[]
): Promise<void> {
  await send(
    emails,
    `Material Arrived: ${material} — ${item.ppoNumber}`,
    wrap("Material received", table(
      row("Client", item.clientName),
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

export async function notifyBulkReleasingDone(
  count: number,
  emails: string[]
): Promise<void> {
  await send(
    emails,
    `${count} Item${count !== 1 ? "s" : ""} Released — Ready for Carpentry`,
    wrap("Drawing completed — items ready for production", `
      <p><strong>${count}</strong> item${count !== 1 ? "s have" : " has"} been released from the <strong>Drawing</strong> stage via Excel import.</p>
      <p style="color:#555;margin-top:8px">These items are now ready for the <strong>Carpentry</strong> stage. Please check the Stages page for the full list.</p>
    `)
  );
}

export async function notifyInProgressOverdue(
  stage: string,
  items: { ppoNumber: string; itemCode: string; clientName: string; daysInProgress: number }[],
  emails: string[]
): Promise<void> {
  const stageLabel = stage.charAt(0).toUpperCase() + stage.slice(1);
  const itemRows = items
    .sort((a, b) => b.daysInProgress - a.daysInProgress)
    .map(i => `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-size:13px">${i.ppoNumber}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-size:13px">${i.itemCode}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0">${i.clientName}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;color:#dc2626;font-weight:600">${i.daysInProgress} day${i.daysInProgress !== 1 ? "s" : ""}</td>
    </tr>`).join("");

  await send(
    emails,
    `⚠️ ${items.length} Item${items.length !== 1 ? "s" : ""} Stuck in ${stageLabel} (>7 days)`,
    wrap(`${stageLabel} — overdue items`, `
      <p style="color:#dc2626;font-weight:600">${items.length} item${items.length !== 1 ? "s have" : " has"} been <strong>In Progress</strong> in the <strong>${stageLabel}</strong> stage for more than 7 days without being completed.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
        <thead>
          <tr style="background:#fef2f2">
            <th style="padding:8px 10px;text-align:left;font-size:12px;color:#666;border-bottom:2px solid #fee2e2">PPO</th>
            <th style="padding:8px 10px;text-align:left;font-size:12px;color:#666;border-bottom:2px solid #fee2e2">Item Code</th>
            <th style="padding:8px 10px;text-align:left;font-size:12px;color:#666;border-bottom:2px solid #fee2e2">Client</th>
            <th style="padding:8px 10px;text-align:left;font-size:12px;color:#666;border-bottom:2px solid #fee2e2">Days In Progress</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p style="color:#555">Please update the status or add a <strong>Reason of Delay</strong> in the dashboard if work is blocked.</p>
    `)
  );
}

export async function notifyStageDone(
  item: { itemCode: string; ppoNumber: string; clientName: string },
  completedStage: string,
  nextStage: string,
  emails: string[]
): Promise<void> {
  const stageName = completedStage.charAt(0).toUpperCase() + completedStage.slice(1);
  await send(
    emails,
    `${stageName} Done — ${item.ppoNumber} (${item.itemCode}) ready for ${nextStage}`,
    wrap(`${stageName} stage completed`, table(
      row("Client", item.clientName),
      row("PPO Number", item.ppoNumber),
      row("Item Code", item.itemCode),
      row("Completed Stage", stageName),
      row("Next Stage", `<span style="color:#2563eb">${nextStage}</span>`),
    ) + `<p style="color:#555">This item is now ready for the <strong>${nextStage}</strong> stage.</p>`)
  );
}
