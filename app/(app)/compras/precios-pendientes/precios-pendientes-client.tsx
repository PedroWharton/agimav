"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/states";
import { NumberInput } from "@/components/app/number-input";

import { resolverPrecioInsumo } from "./actions";

export type PrecioPendienteRow = {
  id: number;
  itemCodigo: string;
  itemDescripcion: string;
  cantidad: number;
  unidadMedida: string;
  mantenimientoId: number;
  maquina: string;
};

export function PreciosPendientesClient({
  rows,
  canResolve,
}: {
  rows: PrecioPendienteRow[];
  canResolve: boolean;
}) {
  const t = useTranslations("compras.preciosPendientes");
  const tCommon = useTranslations("listados.common");
  const router = useRouter();
  const [precios, setPrecios] = useState<Record<number, number | "">>({});
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  if (rows.length === 0) {
    return (
      <EmptyState
        variant="no-data"
        title={t("vacioTitulo")}
        description={t("vacioDescripcion")}
      />
    );
  }

  function resolve(id: number) {
    const precio = precios[id];
    if (typeof precio !== "number" || precio < 0) {
      toast.error(t("precioInvalido"));
      return;
    }
    setPendingId(id);
    startTransition(async () => {
      const res = await resolverPrecioInsumo({
        insumoId: id,
        costoUnitario: precio,
      });
      setPendingId(null);
      if (res.ok) {
        toast.success(t("resueltoOk"));
        router.refresh();
        return;
      }
      toast.error(
        res.error === "forbidden"
          ? tCommon("errorForbidden")
          : tCommon("errorGuardar"),
      );
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 text-left font-medium">
              {t("columnas.item")}
            </th>
            <th className="px-3 py-2.5 text-left font-medium w-52">
              {t("columnas.mantenimiento")}
            </th>
            <th className="px-3 py-2.5 text-right font-medium w-28">
              {t("columnas.cantidad")}
            </th>
            <th className="px-3 py-2.5 text-right font-medium w-60">
              {t("columnas.precio")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="px-3 py-2">
                <div className="font-mono text-[11px] text-muted-foreground">
                  {r.itemCodigo || "—"}
                </div>
                <div className="text-sm font-medium">
                  {r.itemDescripcion || "—"}
                </div>
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/mantenimiento/${r.mantenimientoId}`}
                  className="font-mono text-xs text-sky-700 underline-offset-2 hover:underline dark:text-sky-300"
                >
                  #{r.mantenimientoId}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {r.maquina}
                </div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.cantidad}
                {r.unidadMedida ? (
                  <span className="ml-1 text-xs text-muted-foreground">
                    {r.unidadMedida}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center justify-end gap-2">
                  <NumberInput
                    value={precios[r.id] ?? ""}
                    onChange={(v) =>
                      setPrecios((p) => ({
                        ...p,
                        [r.id]: typeof v === "number" ? v : "",
                      }))
                    }
                    min={0}
                    step={0.01}
                    className="h-9 w-32 text-right tabular-nums"
                    aria-label={t("columnas.precio")}
                    disabled={!canResolve || pendingId === r.id}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => resolve(r.id)}
                    disabled={!canResolve || pendingId === r.id}
                  >
                    {t("resolver")}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
