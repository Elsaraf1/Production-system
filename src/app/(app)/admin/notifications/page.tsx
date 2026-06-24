import { prisma } from "@/lib/prisma";
import { CcEmailManager } from "./cc-email-manager";

export default async function NotificationsPage() {
  const ccEmails = await prisma.ccEmail.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="lg:sticky lg:top-0 lg:z-20 lg:bg-gray-50 lg:-mx-7 lg:px-7 lg:h-[68px] lg:flex lg:items-center lg:border-b lg:border-gray-200">
        <h1 className="text-2xl font-semibold">Notification Settings</h1>
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
