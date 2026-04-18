import type { NextAuthConfig } from "next-auth";

// Edge-safe config shared by auth.ts (Node) and proxy.ts (Edge).
// No Prisma or bcrypt imports here — those live in auth.ts only.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  session: { strategy: "jwt" },
  callbacks: {
    authorized: ({ auth, request: { nextUrl } }) => {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;
      const isPublic =
        pathname.startsWith("/login") ||
        pathname.startsWith("/invitacion") ||
        pathname.startsWith("/api/auth") ||
        pathname === "/favicon.ico";
      if (isPublic) return true;
      return isLoggedIn;
    },
    jwt: ({ token, user }) => {
      if (user) {
        token.userId = (user as { id?: string }).id;
        token.rol = (user as { rol?: string | null }).rol ?? null;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        (session.user as { id?: string }).id = token.userId as string;
        (session.user as { rol?: string | null }).rol =
          (token.rol as string | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
