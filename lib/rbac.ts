import type { Session } from "next-auth";

import { ADMIN_ALL } from "@/lib/permisos/catalog";

export const ADMIN_ROL = "Administrador";
export const PANOLERO_ROL = "Pañolero";

function rolOf(session: Session | null | undefined): string | null {
  if (!session?.user || !("rol" in session.user)) return null;
  return (session.user as { rol?: string | null }).rol ?? null;
}

export function permisosOf(session: Session | null | undefined): string[] {
  if (!session?.user || !("permisos" in session.user)) return [];
  const raw = (session.user as { permisos?: unknown }).permisos;
  return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === "string") : [];
}

/**
 * True when the session carries `codigo` (or the `admin.all` umbrella).
 *
 * Transition fallback: if the JWT predates Slice A (no `permisos` array) and
 * the rol is `Administrador`, grant. Keeps existing admin sessions alive
 * until the next login. Drop this fallback once we're confident all JWTs
 * have cycled (~2 weeks post-deploy).
 */
export function hasPermission(
  session: Session | null | undefined,
  codigo: string,
): boolean {
  if (!session?.user) return false;
  const permisos = permisosOf(session);
  if (permisos.length === 0 && rolOf(session) === ADMIN_ROL) return true;
  return permisos.includes(ADMIN_ALL) || permisos.includes(codigo);
}

export function requirePermission(
  session: Session | null | undefined,
  codigo: string,
): asserts session is Session {
  if (!hasPermission(session, codigo)) throw new Error("forbidden");
}

export function isAdmin(session: Session | null | undefined): boolean {
  return hasPermission(session, ADMIN_ALL);
}

export function isPañolero(session: Session | null | undefined): boolean {
  const r = rolOf(session);
  return r === PANOLERO_ROL || r === ADMIN_ROL || isAdmin(session);
}

export function requireAdmin(session: Session | null | undefined): asserts session is Session {
  if (!isAdmin(session)) throw new Error("forbidden");
}

export function requirePañolero(session: Session | null | undefined): asserts session is Session {
  if (!isPañolero(session)) throw new Error("forbidden");
}

export function requireAuthenticated(
  session: Session | null | undefined,
): asserts session is Session {
  if (!session?.user) throw new Error("forbidden");
}

export function userNameFromSession(
  session: Session | null | undefined,
): string | null {
  const u = session?.user;
  if (!u) return null;
  return (u as { name?: string | null }).name ?? u.email ?? null;
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
