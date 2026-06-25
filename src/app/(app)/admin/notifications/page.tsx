import { prisma } from "@/lib/prisma";
import { CcEmailManager } from "./cc-email-manager";
import { TestEmailForm } from "./test-email-form";

export default async function NotificationsPage() {
  const ccEmails = await prisma.ccEmail.findMany({ orderBy: { createdAt: "asc" } });
  const hasApiKey = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="lg:sticky lg:top-0 lg:z-20 lg:bg-gray-50 lg:-mx-7 lg:px-7 lg:h-[68px] lg:flex lg:items-center lg:border-b lg:border-gray-200">
        <h1 className="text-2xl font-semibold">Notification Settings</h1>
      </div>

      <div className="rounded-xl border bg-white shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Email Status</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Check that the email system is configured and working.
            </p>
          </div>
          <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${hasApiKey ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
            {hasApiKey ? "API key set" : "API key missing"}
          </span>
        </div>
        {!hasApiKey && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            Add <code className="font-mono font-semibold">GMAIL_USER</code> and <code className="font-mono font-semibold">GMAIL_APP_PASSWORD</code> to your <code className="font-mono">.env.local</code> file (and to Vercel environment variables) then restart the dev server.
          </div>
        )}
        <TestEmailForm />
      </div>

      <div className="rounded-xl border bg-white shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold">CC Email List</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            These addresses are automatically CC'd on every notification email sent by the system.
          </p>
        </div>
        <CcEmailManager initialRows={ccEmails} />
      </div>
    </div>
  );
}
