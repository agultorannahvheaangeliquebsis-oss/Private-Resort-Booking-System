import { auth, signOut } from "@/lib/auth";
import { Brandmark } from "@/components/Brandmark";

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
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-sky-border bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Brandmark className="h-10 w-10 shrink-0" />
            <div className="leading-tight">
              <p className="text-base font-extrabold tracking-tight text-navy-800">
                Fabian&apos;s Azzure
              </p>
              <p className="text-xs font-medium text-sunset-500">
                Booking Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {session?.user?.name && (
              <span className="hidden text-sm text-navy-500 sm:inline">
                {session.user.name}
              </span>
            )}
            <form action={handleSignOut}>
              <button
                type="submit"
                className="rounded-lg border border-sky-border bg-white px-3 py-1.5 text-sm font-semibold text-navy-700 transition hover:bg-sky-panel"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
