"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export type LoginState = { error: string } | undefined;

export async function authenticate(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const ip = await getClientIp();
  const limited = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  if (!limited.ok) {
    return { error: "Too many attempts. Please try again in a few minutes." };
  }

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // signIn throws a NEXT_REDIRECT control-flow error on success — it must
    // be re-thrown so Next.js can perform the redirect.
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }
  return undefined;
}
