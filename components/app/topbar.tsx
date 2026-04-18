import { getTranslations } from "next-intl/server";

import { auth, signOut } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export async function Topbar() {
  const session = await auth();
  const t = await getTranslations();

  const user = session?.user;
  const nombre = user?.name ?? "—";
  const email = user?.email ?? "";
  const iniciales = nombre
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="h-14 shrink-0 flex items-center justify-end gap-3 border-b border-border bg-background px-4 md:px-6">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent transition-colors"
          >
            <Avatar className="size-8">
              <AvatarFallback>{iniciales || "?"}</AvatarFallback>
            </Avatar>
            <div className="hidden sm:flex flex-col items-start leading-tight">
              <span className="text-sm font-medium">{nombre}</span>
              <span className="text-xs text-muted-foreground">{email}</span>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span>{nombre}</span>
              {email && (
                <span className="text-xs text-muted-foreground font-normal">
                  {email}
                </span>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full text-left">
                {t("nav.cerrarSesion")}
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
