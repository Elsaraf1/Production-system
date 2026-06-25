import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return new Response(null, { status: 403 });

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return Response.json({ error: "GMAIL_USER or GMAIL_APP_PASSWORD is not set." }, { status: 400 });
  }

  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return Response.json({ error: "Email address is required." }, { status: 400 });
  }

  const BASE_URL = process.env.NEXTAUTH_URL ?? "https://production-system-pi.vercel.app";

  try {
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    await transport.sendMail({
      from: `Production Dashboard <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Test Email — Production Dashboard",
      html: `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
        <p style="color:#888;font-size:12px;margin-bottom:16px">Production Dashboard — Batal Furniture</p>
        <h2 style="margin:0 0 16px;font-size:20px">Test email</h2>
        <p>This is a test email confirming that your notification system is configured correctly.</p>
        <p style="color:#555;margin-top:16px">If you received this, emails are working.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="color:#888;font-size:12px"><a href="${BASE_URL}" style="color:#2563eb;text-decoration:none">Open Dashboard →</a></p>
      </body></html>`,
    });

    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email.";
    return Response.json({ error: message }, { status: 500 });
  }
}
