import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { SidebarNav, type SidebarBadges } from "@/components/app/sidebar-nav";
import { auth, signOut } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";

export type { SidebarBadges };

function computeInitials(name: string | null | undefined, email: string | null | undefined): string {
  const source = name?.trim() || email?.trim() || "";
  if (!source) return "?";
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return source[0].toUpperCase();
}

export async function Sidebar({ badges }: { badges?: SidebarBadges }) {
  const session = await auth();
  const t = await getTranslations();

  const user = session?.user;
  const nombre = user?.name?.trim() || user?.email || "—";
  const role = isAdmin(session) ? "Administrador" : "Usuario";
  const initials = computeInitials(user?.name, user?.email);
  const signOutLabel = t("nav.cerrarSesion");

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="text-base font-semibold tracking-tight">
          {t("app.nombre")}
        </div>
        <div className="text-xs text-subtle-foreground">{t("app.tagline")}</div>
      </div>

      <SidebarNav badges={badges} />

      <div className="mt-auto flex items-center gap-3 border-t border-sidebar-border px-3 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-weak text-sm font-semibold text-foreground">
          {initials}
        </div>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-sm font-semibold text-foreground">
            {nombre}
          </span>
          <span className="truncate text-xs text-subtle-foreground">
            {role}
          </span>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            title={signOutLabel}
            aria-label={signOutLabel}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-subtle-foreground hover:bg-muted-2 hover:text-foreground transition-colors"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}
