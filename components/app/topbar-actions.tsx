"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Bell, Search, Settings2 } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TweaksPanel } from "@/components/app/tweaks-panel";

export function TopbarActions() {
  const t = useTranslations("topbar");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [tweaksOpen, setTweaksOpen] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      {/* Center search trigger pill */}
      <div className="flex-1 flex justify-center px-4">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label={t("buscar.placeholder")}
          className="h-9 rounded-full border border-border bg-muted-2 hover:bg-muted text-sm text-subtle-foreground px-4 inline-flex items-center gap-2 max-w-[420px] w-full transition-colors"
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate text-left flex-1">
            {t("buscar.placeholder")}
          </span>
          <kbd className="ml-auto hidden sm:inline-flex items-center rounded-sm border border-border-strong bg-background px-1.5 py-0.5 text-[11px] font-mono text-subtle-foreground">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right icon row */}
      <div className="flex items-center gap-1">
        {/* Tweaks gear */}
        <button
          type="button"
          onClick={() => setTweaksOpen(true)}
          aria-label={t("tweaks.abrir")}
          className="grid size-[34px] place-items-center rounded-lg border border-transparent bg-transparent text-subtle-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Settings2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>

        {/* Notifications bell (disabled) */}
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Span wrapper so the tooltip still fires on a disabled button */}
            <span className="inline-flex">
              <button
                type="button"
                disabled
                aria-disabled="true"
                aria-label={t("notificaciones.etiqueta")}
                className="grid size-[34px] place-items-center rounded-lg border border-transparent bg-transparent text-subtle-foreground/60 cursor-not-allowed"
              >
                <Bell className="size-4" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t("notificaciones.proximamente")}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Command palette dialog */}
      <CommandDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title={t("buscar.placeholder")}
        description={t("buscar.placeholder")}
      >
        <CommandInput placeholder={t("buscar.dialogPlaceholder")} />
        <CommandList>
          <CommandEmpty>{t("buscar.proximamente")}</CommandEmpty>
          <CommandItem disabled>
            <Search className="size-4" aria-hidden="true" />
            <span>{t("buscar.proximamente")}</span>
          </CommandItem>
        </CommandList>
      </CommandDialog>

      <TweaksPanel open={tweaksOpen} onOpenChange={setTweaksOpen} />
    </>
  );
}
