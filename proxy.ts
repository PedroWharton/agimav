import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Next.js 16 renamed middleware.ts → proxy.ts.
// Auth.js v5 edge-safe guard: reads the session cookie, enforces authConfig.callbacks.authorized.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
