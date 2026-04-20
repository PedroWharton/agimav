"use client";

import type { ReactNode } from "react";
import { Check, X } from "lucide-react";

import { MANT_ESTADOS, type MantEstado } from "@/lib/mantenimiento/estado";
import { OT_ESTADOS, type OtEstado } from "@/app/(app)/ordenes-trabajo/types";
import { cn } from "@/lib/utils";

export type StepState = "done" | "current" | "future" | "cancelled";

export type Step = {
  id: string;
  label: string;
  state: StepState;
  /** Optional sub-chip rendered below the label (e.g. Chacra / Taller). */
  meta?: ReactNode;
};

const NODE_BY_STATE: Record<StepState, string> = {
  done: "bg-success text-white border-transparent",
  current: "bg-brand text-white border-transparent",
  future:
    "bg-card text-subtle-foreground border-border",
  cancelled: "bg-danger-weak text-danger border-transparent",
};

function connectorClass(prev: StepState, next: StepState): string {
  if (prev === "cancelled" || next === "cancelled") return "bg-danger-weak";
  if (prev === "done" && next === "done") return "bg-success";
  if (prev === "done" && next === "current") return "bg-brand";
  if (prev === "done") return "bg-success";
  if (prev === "current") return "bg-brand";
  return "bg-border";
}

/**
 * Variant-agnostic horizontal stepper (§4.12). Accepts pre-computed `steps`;
 * consumers map their domain state → steps via the presets below.
 */
export function StatusMeter({
  steps,
  className,
}: {
  steps: Step[];
  className?: string;
}) {
  return (
    <ol
      className={cn("flex w-full items-start gap-2", className)}
      aria-label="Progreso"
    >
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const next = steps[i + 1];
        return (
          <li
            key={step.id}
            className="flex min-w-0 flex-1 items-start gap-2"
          >
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-center gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                    NODE_BY_STATE[step.state],
                  )}
                >
                  {step.state === "done" ? (
                    <Check className="size-3.5" strokeWidth={3} />
                  ) : step.state === "cancelled" ? (
                    <X className="size-3.5" strokeWidth={3} />
                  ) : (
                    i + 1
                  )}
                </span>
                {!isLast && next ? (
                  <span
                    aria-hidden
                    className={cn(
                      "h-1 flex-1 rounded-full",
                      connectorClass(step.state, next.state),
                    )}
                  />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-col items-start gap-1 self-start">
                <span
                  className={cn(
                    "text-xs font-medium",
                    step.state === "cancelled" &&
                      "text-subtle-foreground line-through",
                    step.state === "future" && "text-subtle-foreground",
                  )}
                >
                  {step.label}
                </span>
                {step.meta ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium text-foreground">
                    {step.meta}
                  </span>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- presets ---------- */

function isMantEstado(value: string): value is MantEstado {
  return (MANT_ESTADOS as readonly string[]).includes(value);
}

function isOtEstado(value: string): value is OtEstado {
  return (OT_ESTADOS as readonly string[]).includes(value);
}

/**
 * 3-step preset for `lib/mantenimiento/estado.ts` (Pendiente / En reparación /
 * Finalizado). Both "En Reparación - *" variants collapse into step 2 with the
 * `reparacionEn` chip. `Cancelado` flips every non-done step to `cancelled`.
 */
export function MantenimientoStatusMeter({
  estado,
  reparacionEn,
  className,
}: {
  estado: string;
  reparacionEn?: "Chacra" | "Taller";
  className?: string;
}) {
  const safe = isMantEstado(estado) ? estado : "Pendiente";

  // derive each step's state purely from the current estado
  let step1: StepState = "current"; // Pendiente
  let step2: StepState = "future"; // En reparación
  let step3: StepState = "future"; // Finalizado

  let middleMeta: ReactNode = null;

  switch (safe) {
    case "Pendiente":
      step1 = "current";
      step2 = "future";
      step3 = "future";
      break;
    case "En Reparación - Chacra":
    case "En Reparación - Taller": {
      step1 = "done";
      step2 = "current";
      step3 = "future";
      const flavor =
        reparacionEn ??
        (safe === "En Reparación - Chacra" ? "Chacra" : "Taller");
      middleMeta = flavor;
      break;
    }
    case "Finalizado":
      step1 = "done";
      step2 = "done";
      step3 = "done";
      if (reparacionEn) middleMeta = reparacionEn;
      break;
    case "Cancelado":
      step1 = "cancelled";
      step2 = "cancelled";
      step3 = "cancelled";
      break;
  }

  const steps: Step[] = [
    { id: "pendiente", label: "Pendiente", state: step1 },
    {
      id: "reparacion",
      label: "En reparación",
      state: step2,
      meta: middleMeta,
    },
    { id: "finalizado", label: "Finalizado", state: step3 },
  ];

  return <StatusMeter steps={steps} className={className} />;
}

/**
 * 2-step preset for `app/(app)/ordenes-trabajo/types.ts` (En curso / Cerrada).
 * `Cancelada` flips every non-done step to `cancelled`.
 */
export function OtStatusMeter({
  estado,
  className,
}: {
  estado: string;
  className?: string;
}) {
  const safe = isOtEstado(estado) ? estado : "En Curso";

  let step1: StepState = "current";
  let step2: StepState = "future";

  switch (safe) {
    case "En Curso":
      step1 = "current";
      step2 = "future";
      break;
    case "Cerrada":
      step1 = "done";
      step2 = "done";
      break;
    case "Cancelada":
      step1 = "cancelled";
      step2 = "cancelled";
      break;
  }

  const steps: Step[] = [
    { id: "en-curso", label: "En curso", state: step1 },
    { id: "cerrada", label: "Cerrada", state: step2 },
  ];

  return <StatusMeter steps={steps} className={className} />;
}
