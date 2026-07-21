import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UsersManager, type UserRow } from "@/components/UsersManager";

export default async function UsersPage() {
  const session = await auth();
  // Administration is ADMIN-only; send everyone else back to the dashboard.
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const rows = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { bookings: true } },
    },
  });

  const users: UserRow[] = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    bookingCount: u._count.bookings,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-800">
          User management
        </h1>
        <p className="text-sm text-navy-500">
          Manage who can sign in to the booking dashboard and their access
          level.
        </p>
      </div>
      <UsersManager users={users} currentUserId={session.user.id} />
    </div>
  );
}
