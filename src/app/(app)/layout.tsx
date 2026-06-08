import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { SessionProvider } from "next-auth/react";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <SessionProvider session={session}>
      <div className="flex min-h-screen">
        <Sidebar role={session.user.role} displayName={session.user.displayName} />
        <main className="flex-1 overflow-auto bg-gray-50/50 p-7">{children}</main>
      </div>
    </SessionProvider>
  );
}
