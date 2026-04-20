import type { ChipTone } from "@/components/app/status-chip";

export const OC_ESTADOS = [
  "Emitida",
  "Parcialmente Recibida",
  "Completada",
  "Cancelada",
] as const;

export type OcEstado = (typeof OC_ESTADOS)[number];

export type OcEstadoMeta = {
  tone: ChipTone;
  /** i18n key suffix; full key is `compras.common.estados.<i18nKey>` */
  i18nKey: string;
  /** 0–100; null when progress is not meaningful (e.g., Cancelada) */
  progress: number | null;
};

export const OC_ESTADO_META: Record<OcEstado, OcEstadoMeta> = {
  Emitida: { tone: "info", i18nKey: "Emitida", progress: 25 },
  "Parcialmente Recibida": {
    tone: "warn",
    i18nKey: "ParcialmenteRecibida",
    progress: 60,
  },
  Completada: { tone: "ok", i18nKey: "Completada", progress: 100 },
  Cancelada: { tone: "danger", i18nKey: "Cancelada", progress: null },
};

export function isOcEstado(value: string): value is OcEstado {
  return (OC_ESTADOS as readonly string[]).includes(value);
}
