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
      <div className="flex flex-col lg:flex-row min-h-screen lg:h-screen">
        <Sidebar role={session.user.role} displayName={session.user.displayName} />
        <main className="flex-1 overflow-auto lg:h-screen bg-gray-50/50 p-4 sm:p-6 lg:p-7">{children}</main>
      </div>
    </SessionProvider>
  );
}
