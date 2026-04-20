"use client";

import * as React from "react";

// DOM writes kept outside the component so the React Compiler treats them as
// external side-effects, not component-scope mutations.
function hydrateFromStorage() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  try {
    const theme = localStorage.getItem("agimav.theme");
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    }

    const accent = localStorage.getItem("agimav.accent");
    if (accent === "sky" || accent === "amber" || accent === "violet") {
      root.setAttribute("data-accent", accent);
    }

    const density = localStorage.getItem("agimav.density");
    if (density === "compact" || density === "comfortable") {
      root.setAttribute("data-density", density);
    } else if (density === "normal") {
      root.removeAttribute("data-density");
    }
  } catch {
    // localStorage may be unavailable (private mode / disabled cookies);
    // silently fall back to defaults.
  }
}

/**
 * Reads persisted UI tweaks from localStorage on mount and applies them to
 * <html>. The inline script in app/layout.tsx covers the first-paint path to
 * prevent FOUC; this component is a safety net for cases where that script
 * did not run (e.g. tests, embeds). Renders nothing.
 */
export function TweaksHydrator() {
  React.useEffect(() => {
    hydrateFromStorage();
  }, []);

  return null;
}
