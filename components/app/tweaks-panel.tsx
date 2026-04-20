"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// Next.js inlines NEXT_PUBLIC_* at build time — evaluate at module scope so
// the conditional blocks are tree-shakeable when the flag is off.
const TWEAKS_ADVANCED = process.env.NEXT_PUBLIC_TWEAKS_ADVANCED === "1";

const ACCENTS = [
  { value: "sky", label: "Cielo", cssVar: "var(--accent-sky)" },
  { value: "amber", label: "Ámbar", cssVar: "var(--accent-amber)" },
  { value: "violet", label: "Violeta", cssVar: "var(--accent-violet)" },
] as const;

type AccentValue = (typeof ACCENTS)[number]["value"];
type DensityValue = "compact" | "normal" | "comfortable";

// DOM writers live at module scope so the React Compiler treats them as
// external side-effects instead of component-scope mutations.
function applyTheme(next: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", next === "dark");
  try {
    localStorage.setItem("agimav.theme", next);
  } catch {
    /* ignore */
  }
}

function applyAccent(next: AccentValue) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-accent", next);
  try {
    localStorage.setItem("agimav.accent", next);
  } catch {
    /* ignore */
  }
}

function applyDensity(next: DensityValue) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (next === "normal") {
    root.removeAttribute("data-density");
  } else {
    root.setAttribute("data-density", next);
  }
  try {
    localStorage.setItem("agimav.density", next);
  } catch {
    /* ignore */
  }
}

function readInitialState(): {
  theme: "light" | "dark";
  accent: AccentValue;
  density: DensityValue;
} {
  if (typeof document === "undefined") {
    return { theme: "light", accent: "sky", density: "normal" };
  }
  const root = document.documentElement;
  const theme = root.classList.contains("dark") ? "dark" : "light";
  const rawAccent = root.getAttribute("data-accent");
  const accent: AccentValue =
    rawAccent === "amber" || rawAccent === "violet" ? rawAccent : "sky";
  const rawDensity = root.getAttribute("data-density");
  const density: DensityValue =
    rawDensity === "compact" || rawDensity === "comfortable"
      ? rawDensity
      : "normal";
  return { theme, accent, density };
}

export type TweaksPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TweaksPanel({ open, onOpenChange }: TweaksPanelProps) {
  // Lazy init reads the DOM exactly once; the inline <head> script has already
  // applied persisted values by this point so the DOM is the source of truth.
  const [state, setState] = React.useState<{
    theme: "light" | "dark";
    accent: AccentValue;
    density: DensityValue;
  }>(() => readInitialState());

  function handleThemeChange(checked: boolean) {
    const next: "light" | "dark" = checked ? "dark" : "light";
    applyTheme(next);
    setState((prev) => ({ ...prev, theme: next }));
  }

  function handleAccentChange(value: AccentValue) {
    applyAccent(value);
    setState((prev) => ({ ...prev, accent: value }));
  }

  function handleDensityChange(value: string) {
    if (!value) return;
    const next = value as DensityValue;
    applyDensity(next);
    setState((prev) => ({ ...prev, density: next }));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[360px] sm:max-w-[360px]">
        <SheetHeader>
          <SheetTitle>Apariencia</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                Tema oscuro
              </span>
              <span className="text-xs text-subtle-foreground">
                Cambia el contraste de la interfaz.
              </span>
            </div>
            <Switch
              checked={state.theme === "dark"}
              onCheckedChange={handleThemeChange}
              aria-label="Tema oscuro"
            />
          </div>

          {TWEAKS_ADVANCED && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
                Color de acento
              </span>
              <div className="flex items-center gap-2">
                {ACCENTS.map((a) => {
                  const selected = state.accent === a.value;
                  return (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => handleAccentChange(a.value)}
                      aria-label={a.label}
                      aria-pressed={selected}
                      className={cn(
                        "size-8 rounded-full border-2 outline-none transition-[box-shadow,border-color] focus-visible:ring-3 focus-visible:ring-ring/50",
                        selected
                          ? "border-foreground"
                          : "border-transparent hover:border-border-strong"
                      )}
                      style={{ background: a.cssVar }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {TWEAKS_ADVANCED && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
                Densidad
              </span>
              <ToggleGroup
                type="single"
                value={state.density}
                onValueChange={handleDensityChange}
                aria-label="Densidad"
              >
                <ToggleGroupItem value="compact">Compacta</ToggleGroupItem>
                <ToggleGroupItem value="normal">Normal</ToggleGroupItem>
                <ToggleGroupItem value="comfortable">Cómoda</ToggleGroupItem>
              </ToggleGroup>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
