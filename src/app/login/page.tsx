import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Brandmark } from "@/components/Brandmark";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // Already signed in? Skip the form.
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Brandmark className="h-20 w-20" />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-navy-800">
            Fabian&apos;s Azzure
          </h1>
          <p className="text-sm font-medium text-sunset-500">
            Private Resort · Booking Dashboard
          </p>
        </div>

        <div className="rounded-card border border-sky-border bg-white/80 p-6 shadow-xl shadow-navy-900/5 backdrop-blur">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-navy-400">
          Staff access only. Contact the administrator for an account.
        </p>
      </div>
    </main>
  );
}
