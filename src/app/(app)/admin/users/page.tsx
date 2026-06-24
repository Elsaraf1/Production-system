import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { CreateUserForm } from "./create-user-form";
import { UserActions } from "./user-actions";

export default async function UsersPage() {
  const session = await auth();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="lg:sticky lg:top-0 lg:z-20 lg:bg-gray-50 lg:-mx-7 lg:px-7 lg:h-[68px] lg:flex lg:items-center lg:border-b lg:border-gray-200">
        <h1 className="text-2xl font-semibold">User Management</h1>
      </div>
      <CreateUserForm />
      <div className="rounded-lg border bg-white overflow-x-auto lg:overflow-visible lg:isolate">
        <table className="w-full text-sm lg:border-separate lg:border-spacing-0 lg:[&_th]:border-b lg:[&_td]:border-b">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium">Username</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium">Display Name</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium">Role</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium">Department</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium">Email</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium">Status</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className={`hover:bg-gray-50 ${!u.isActive ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 font-mono">{u.username}</td>
                <td className="px-4 py-3">{u.displayName}</td>
                <td className="px-4 py-3"><Badge variant="outline">{u.role}</Badge></td>
                <td className="px-4 py-3">{u.department ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{u.email ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3">
                  <span className={u.isActive ? "text-green-600 text-xs font-medium" : "text-red-500 text-xs font-medium"}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.isActive && (
                    <UserActions
                      userId={u.id}
                      username={u.username}
                      isSelf={u.id === session?.user.id}
                      email={u.email}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
