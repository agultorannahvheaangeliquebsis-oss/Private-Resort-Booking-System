// Next.js 16 renamed the `middleware` convention to `proxy` (nodejs runtime).
// This guards the dashboard: the `authorized` callback in auth.config.ts
// redirects unauthenticated visitors to /login. We build a lightweight
// NextAuth instance from authConfig alone (no Credentials provider, prisma,
// or bcrypt) so the guard stays cheap.
import NextAuth from "next-auth";
import type { NextFetchEvent, NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

// `auth` is heavily overloaded; when used as middleware it is invoked with
// (request, event). Narrow it to that plain signature.
const handler = auth as unknown as (
  request: NextRequest,
  event: NextFetchEvent
) => unknown;

// Explicit function export so Next.js can statically detect the proxy handler.
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  return handler(request, event);
}

export const config = {
  // Run on everything except static assets and the auth API.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
