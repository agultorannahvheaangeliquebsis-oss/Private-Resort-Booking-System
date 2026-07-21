import { auth, signOut } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

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
