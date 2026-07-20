import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  // Self-hosted (not on Vercel): trust the deployment host so Auth.js does
  // not reject requests with UntrustedHost. Configure the canonical URL via
  // AUTH_URL in production.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false;
      }
      return true;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.role) session.user.role = token.role as string;
      return session;
    },
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
  },
  providers: [],
} satisfies NextAuthConfig;