import type { Session } from "next-auth";

export const ADMIN_ROL = "Administrador";
export const PANOLERO_ROL = "Pañolero";

function rolOf(session: Session | null | undefined): string | null {
  if (!session?.user || !("rol" in session.user)) return null;
  return (session.user as { rol?: string | null }).rol ?? null;
}

export function isAdmin(session: Session | null | undefined): boolean {
  return rolOf(session) === ADMIN_ROL;
}

export function isPañolero(session: Session | null | undefined): boolean {
  const r = rolOf(session);
  return r === PANOLERO_ROL || r === ADMIN_ROL;
}

export function requireAdmin(session: Session | null | undefined): asserts session is Session {
  if (!isAdmin(session)) throw new Error("forbidden");
}

export function requirePañolero(session: Session | null | undefined): asserts session is Session {
  if (!isPañolero(session)) throw new Error("forbidden");
}

export function userIdFromSession(
  session: Session | null | undefined,
): number | null {
  const raw = session?.user && "id" in session.user
    ? (session.user as { id?: string }).id
    : undefined;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
