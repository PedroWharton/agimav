"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/states";
import { NumberInput } from "@/components/app/number-input";

import { resolverPrecioInsumo, resolverPrecioOtInsumo } from "./actions";

export type PrecioPendienteRow = {
  id: number;
  itemCodigo: string;
  itemDescripcion: string;
  cantidad: number;
  unidadMedida: string;
  mantenimientoId: number;
  maquina: string;
};

export type PrecioPendienteOtRow = {
  id: number;
  itemCodigo: string;
  itemDescripcion: string;
  cantidad: number;
  unidadMedida: string;
  otId: number;
  otNumero: string;
  otTitulo: string;
};

type UnifiedRow = {
  key: string;
  tipo: "mantenimiento" | "ot";
  id: number;
  itemCodigo: string;
  itemDescripcion: string;
  cantidad: number;
  unidadMedida: string;
  href: string;
  origenLabel: string;
  origenSub: string;
};

export function PreciosPendientesClient({
  rows,
  otRows,
  canResolve,
}: {
  rows: PrecioPendienteRow[];
  otRows: PrecioPendienteOtRow[];
  canResolve: boolean;
}) {
  const t = useTranslations("compras.preciosPendientes");
  const tCommon = useTranslations("listados.common");
  const router = useRouter();
  const [precios, setPrecios] = useState<Record<string, number | "">>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const unified: UnifiedRow[] = [
    ...rows.map<UnifiedRow>((r) => ({
      key: `mantenimiento-${r.id}`,
      tipo: "mantenimiento",
      id: r.id,
      itemCodigo: r.itemCodigo,
      itemDescripcion: r.itemDescripcion,
      cantidad: r.cantidad,
      unidadMedida: r.unidadMedida,
      href: `/mantenimiento/${r.mantenimientoId}`,
      origenLabel: `#${r.mantenimientoId}`,
      origenSub: r.maquina,
    })),
    ...otRows.map<UnifiedRow>((r) => ({
      key: `ot-${r.id}`,
      tipo: "ot",
      id: r.id,
      itemCodigo: r.itemCodigo,
      itemDescripcion: r.itemDescripcion,
      cantidad: r.cantidad,
      unidadMedida: r.unidadMedida,
      href: `/ordenes-trabajo/${r.otId}`,
      origenLabel: r.otNumero,
      origenSub: r.otTitulo,
    })),
  ];

  if (unified.length === 0) {
    return (
      <EmptyState
        variant="no-data"
        title={t("vacioTitulo")}
        description={t("vacioDescripcion")}
      />
    );
  }

  function resolve(row: UnifiedRow) {
    const precio = precios[row.key];
    if (typeof precio !== "number" || precio < 0) {
      toast.error(t("precioInvalido"));
      return;
    }
    setPendingKey(row.key);
    startTransition(async () => {
      const action =
        row.tipo === "ot" ? resolverPrecioOtInsumo : resolverPrecioInsumo;
      const res = await action({
        insumoId: row.id,
        costoUnitario: precio,
      });
      setPendingKey(null);
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
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 text-left font-medium">
              {t("columnas.item")}
            </th>
            <th className="px-3 py-2.5 text-left font-medium w-64">
              {t("columnas.origen")}
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
          {unified.map((r) => (
            <tr key={r.key} className="border-t border-border">
              <td className="px-3 py-2">
                <div className="font-mono text-[11px] text-muted-foreground">
                  {r.itemCodigo || "—"}
                </div>
                <div className="text-sm font-medium">
                  {r.itemDescripcion || "—"}
                </div>
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {r.tipo === "ot"
                      ? t("origenOt")
                      : t("origenMantenimiento")}
                  </Badge>
                  <Link
                    href={r.href}
                    className="font-mono text-xs text-sky-700 underline-offset-2 hover:underline dark:text-sky-300"
                  >
                    {r.origenLabel}
                  </Link>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {r.origenSub}
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
                    value={precios[r.key] ?? ""}
                    onChange={(v) =>
                      setPrecios((p) => ({
                        ...p,
                        [r.key]: typeof v === "number" ? v : "",
                      }))
                    }
                    min={0}
                    step={0.01}
                    className="h-9 w-32 text-right tabular-nums"
                    aria-label={t("columnas.precio")}
                    disabled={!canResolve || pendingKey === r.key}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => resolve(r)}
                    disabled={!canResolve || pendingKey === r.key}
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
