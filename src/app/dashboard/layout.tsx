import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // The dashboard is admin-only — there are no staff accounts, and guests
  // book through the public /book form without needing an account.
  if (session?.user?.role !== "ADMIN") redirect("/book");

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <DashboardShell
      isAdmin={session?.user?.role === "ADMIN"}
      userName={session?.user?.name}
      signOut={handleSignOut}
    >
      {children}
    </DashboardShell>
  );
}
