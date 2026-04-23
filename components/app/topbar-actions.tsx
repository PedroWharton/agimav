"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Settings2 } from "lucide-react";

import { TweaksPanel } from "@/components/app/tweaks-panel";

export function TopbarActions() {
  const t = useTranslations("topbar");
  const [tweaksOpen, setTweaksOpen] = React.useState(false);

  return (
    <>
      <div className="flex-1" aria-hidden />

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setTweaksOpen(true)}
          aria-label={t("tweaks.abrir")}
          className="grid size-[34px] place-items-center rounded-lg border border-transparent bg-transparent text-subtle-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Settings2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      <TweaksPanel open={tweaksOpen} onOpenChange={setTweaksOpen} />
    </>
  );
}
