import {
  Truck,
  Tractor,
  Forklift,
  Construction,
  Wrench,
  Car,
  type LucideIcon,
} from "lucide-react";
import { createElement, forwardRef, type SVGProps } from "react";

import type { ChipTone } from "@/components/app/status-chip";

/**
 * Estado → ChipTone mapping.
 *
 * Legacy `Maquinaria.estado` values observed in production (per `scripts/maquinaria-probe.ts`):
 * `activo`, `inactivo`, `baja`. We normalize case-insensitively and map to tones.
 */
export function statusChip(estado: string | null | undefined): {
  tone: ChipTone;
  label: string;
} {
  const raw = (estado ?? "").trim();
  const key = raw.toLowerCase();
  switch (key) {
    case "activo":
    case "operativo":
    case "operativa":
      return { tone: "ok", label: cap(raw || "Activo") };
    case "mantenimiento":
    case "en taller":
    case "taller":
      return { tone: "warn", label: cap(raw || "En taller") };
    case "baja":
    case "fuera":
    case "fuera de servicio":
      return { tone: "danger", label: cap(raw || "Baja") };
    case "inactivo":
    case "inactiva":
      return { tone: "neutral", label: cap(raw || "Inactivo") };
    default:
      return { tone: "neutral", label: raw ? cap(raw) : "—" };
  }
}

/**
 * Service health indicator derived from horas acumuladas progress or a next
 * service hint. We don't have scheduled-service data in the current schema, so
 * we compute a proxy from `horasAcumuladas`. Returns a tone suitable for the
 * progress-bar color + short label.
 *
 * Heuristic per design (`maquinaria.html`): if estado marks equipo detenido
 * (baja/fuera) → danger; otherwise return a neutral "—" label unless
 * `proxHoras` is supplied.
 */
export function serviceHealth(m: {
  estado?: string | null;
  horasAcumuladas?: number | null;
  proxHoras?: number | null;
}): { tone: ChipTone; pct: number; label: string } {
  const est = (m.estado ?? "").toLowerCase();
  if (est === "baja" || est === "fuera" || est === "fuera de servicio") {
    return { tone: "danger", pct: 100, label: "Detenida" };
  }
  const horas = Number.isFinite(m.horasAcumuladas ?? NaN)
    ? Number(m.horasAcumuladas)
    : null;
  const prox = Number.isFinite(m.proxHoras ?? NaN) ? Number(m.proxHoras) : null;
  if (horas != null && prox != null) {
    const rem = prox - horas;
    if (rem <= 0) {
      return { tone: "danger", pct: 100, label: `vencido (${Math.abs(rem)} hs)` };
    }
    if (rem <= 50) return { tone: "warn", pct: 92, label: `en ${rem} hs` };
    if (rem <= 150) return { tone: "warn", pct: 80, label: `en ${rem} hs` };
    const totalBetween = 250;
    const pct = Math.max(
      10,
      Math.min(95, 100 - (rem / totalBetween) * 100),
    );
    return { tone: "ok", pct, label: `en ${rem} hs` };
  }
  // No schedule info available → neutral progress bar.
  return { tone: "neutral", pct: 0, label: "—" };
}

/**
 * Equipment icon glyph derived from tipo name. Unrecognized tipos fall back
 * to the generic `Wrench` glyph (fleet default).
 *
 * Exported as `equipIcon` for programmatic use (ChoosePicker etc.), and also
 * wrapped in the `<EquipIcon>` component below for safe rendering in JSX
 * (creating a component from a helper during render is forbidden by the
 * `react-hooks/static-components` lint rule).
 */
export function equipIcon(tipo: string | null | undefined): LucideIcon {
  return resolveIcon(tipo);
}

function resolveIcon(tipo: string | null | undefined): LucideIcon {
  const key = (tipo ?? "").toLowerCase();
  if (!key) return Wrench;
  if (key.includes("tractor")) return Tractor;
  if (key.includes("camión") || key.includes("camion")) return Truck;
  if (key.includes("vehículo") || key.includes("vehiculo") || key.includes("auto"))
    return Car;
  if (
    key.includes("autoelevador") ||
    key.includes("elevador") ||
    key.includes("minicargadora") ||
    key.includes("cargadora")
  )
    return Forklift;
  if (
    key.includes("excavadora") ||
    key.includes("retro") ||
    key.includes("bulldozer") ||
    key.includes("motoniveladora") ||
    key.includes("plataforma") ||
    key.includes("grúa") ||
    key.includes("grua")
  )
    return Construction;
  if (
    key.includes("curadora") ||
    key.includes("trituradora") ||
    key.includes("rotoenfardadora") ||
    key.includes("abonadora")
  )
    return Wrench;
  return Wrench;
}

export type EquipIconProps = SVGProps<SVGSVGElement> & {
  tipo: string | null | undefined;
};

/**
 * Renders the correct equipment icon for a given tipo. Use this instead of
 * calling `resolveIcon` + creating the component in render — React's static
 * components rule forbids the latter.
 */
export const EquipIcon = forwardRef<SVGSVGElement, EquipIconProps>(
  function EquipIcon({ tipo, ...props }, ref) {
    const Icon = resolveIcon(tipo);
    return createElement(Icon, { ref, ...props });
  },
);

function cap(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
