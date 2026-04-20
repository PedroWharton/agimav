"use client";

import type { JSX } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/utils";

export type MatchStatus = "match" | "mismatch" | "no-oc";

const ARS_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

function formatARS(value: number): string {
  if (!Number.isFinite(value)) return "ARS —";
  return ARS_FORMATTER.format(value);
}

export function MatchBanner({
  status,
  ocNumero,
  ocTotal,
  facturaTotal,
}: {
  status: MatchStatus;
  ocNumero?: string;
  ocTotal?: number;
  facturaTotal: number;
}): JSX.Element {
  const base =
    "flex w-full items-center gap-2.5 rounded-xl px-4 py-2.5 text-[12.5px] font-medium";

  if (status === "match") {
    return (
      <div
        role="status"
        className={cn(base, "bg-success-weak text-success")}
        data-status="match"
      >
        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0">
          Coincide con{" "}
          <span className="font-mono font-semibold">{ocNumero ?? "—"}</span>
          {typeof ocTotal === "number" ? (
            <>
              :{" "}
              <span className="font-mono font-semibold">
                {formatARS(ocTotal)}
              </span>
            </>
          ) : null}
        </span>
      </div>
    );
  }

  if (status === "mismatch") {
    return (
      <div
        role="status"
        className={cn(base, "bg-warn-weak text-warn")}
        data-status="mismatch"
      >
        <AlertCircle className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0">
          Difiere de{" "}
          <span className="font-mono font-semibold">{ocNumero ?? "—"}</span>:
          factura{" "}
          <span className="font-mono font-semibold">
            {formatARS(facturaTotal)}
          </span>{" "}
          vs OC{" "}
          <span className="font-mono font-semibold">
            {typeof ocTotal === "number" ? formatARS(ocTotal) : "—"}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div
      role="status"
      className={cn(base, "bg-info-weak text-info")}
      data-status="no-oc"
    >
      <Info className="size-4 shrink-0" aria-hidden />
      <span>Factura no vinculada a una OC</span>
    </div>
  );
}
