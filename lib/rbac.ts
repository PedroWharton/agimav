import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { ADMIN_ALL } from "@/lib/permisos/catalog";

export const ADMIN_ROL = "Administrador";

/**
 * Ordered list of (view permiso → landing path). Used by `firstViewPath`
 * to pick a sensible home for a user based on the permisos they hold.
 * Matches the sidebar order.
 */
const VIEW_ROUTES: Array<{ codigo: string; path: string }> = [
  { codigo: "maquinaria.view", path: "/maquinaria" },
  { codigo: "inventario.view", path: "/inventario" },
  { codigo: "compras.view", path: "/compras/solicitudes" },
  { codigo: "mantenimiento.view", path: "/mantenimiento" },
  { codigo: "ot.view", path: "/ordenes-trabajo" },
  { codigo: "estadisticas.view", path: "/estadisticas" },
  { codigo: "listados.view", path: "/listados" },
];

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
 * Transition fallback: if the JWT predates the permisos rollout (no `permisos`
 * array) and the rol is `Administrador`, grant. Keeps existing admin sessions
 * alive until next login. Drop once all JWTs have cycled (~2 weeks post-deploy).
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

/**
 * First route the user can view, or `null` if they hold no view permiso.
 * Used to pick a landing page after login and as the redirect target when a
 * user hits a route they aren't authorized to view.
 */
export function firstViewPath(session: Session | null | undefined): string | null {
  for (const { codigo, path } of VIEW_ROUTES) {
    if (hasPermission(session, codigo)) return path;
  }
  return null;
}

/**
 * Page-level guard. Call at the top of a server component after loading the
 * session. Redirects to the user's first viewable module if they're missing
 * the required codigo, or to `/sin-permisos` if they have no views at all.
 *
 * Never returns when unauthorized — throws a Next.js redirect.
 */
export function requireViewOrRedirect(
  session: Session | null | undefined,
  codigo: string,
): void {
  if (!session?.user) redirect("/login");
  if (hasPermission(session, codigo)) return;
  const fallback = firstViewPath(session);
  if (fallback && fallback !== currentRoutePrefixFor(codigo)) {
    redirect(fallback);
  }
  redirect("/sin-permisos");
}

function currentRoutePrefixFor(codigo: string): string | null {
  return VIEW_ROUTES.find((r) => r.codigo === codigo)?.path ?? null;
}

export function isAdmin(session: Session | null | undefined): boolean {
  return hasPermission(session, ADMIN_ALL);
}

export function requireAdmin(session: Session | null | undefined): asserts session is Session {
  if (!isAdmin(session)) throw new Error("forbidden");
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
