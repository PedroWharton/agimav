"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrencyARS, formatNumber } from "@/lib/stats/format";

import { MIN_FILTROS, type MaqRow, type MinFiltro } from "./types";

export function MaquinariaStatsClient({ rows }: { rows: MaqRow[] }) {
  const t = useTranslations("estadisticas");
  const [min, setMin] = useState<MinFiltro>("min2");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const total = r.correctivos + r.preventivos;
      if (min === "min2") return total >= 2;
      if (min === "min3") return total >= 3;
      return true;
    });
  }, [rows, min]);

  const minOptions = MIN_FILTROS.map((f) => ({
    value: f,
    label: t(`maquinaria.filtros.${f}`),
  }));

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <Select value={min} onValueChange={(v) => setMin(v as MinFiltro)}>
          <SelectTrigger
            className="w-[200px]"
            aria-label={t("maquinaria.titulo")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {minOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="-mx-5 -mb-5 flex-1 overflow-hidden border-t border-border">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center p-10 text-sm text-muted-foreground">
            {t("maquinaria.vacio")}
          </div>
        ) : (
          <div className="max-h-[560px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left">
                    {t("maquinaria.columnas.maquina")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-left">
                    {t("maquinaria.columnas.tipo")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    {t("maquinaria.columnas.correctivos")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    {t("maquinaria.columnas.preventivos")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right" title={t("maquinaria.mtbfTooltip")}>
                    {t("maquinaria.columnas.mtbf")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    {t("maquinaria.columnas.horas")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    {t("maquinaria.columnas.costo")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-border hover:bg-muted/40"
                  >
                    <td className="px-3 py-2">
                      {r.tipoId ? (
                        <Link
                          href={`/maquinaria/${r.tipoId}`}
                          className="font-medium hover:underline"
                        >
                          {r.nombre}
                        </Link>
                      ) : (
                        <span className="font-medium">{r.nombre}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.tipoNombre ? (
                        <Badge variant="outline">{r.tipoNombre}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.correctivos}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.preventivos}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {r.mtbf !== null ? (
                        <span title={t(`maquinaria.mtbfUnidad.${r.mtbfSource}`)}>
                          {formatNumber(r.mtbf, r.mtbfSource === "horas" ? 0 : 1)}
                          <span className="ml-1 text-[10px] uppercase">
                            {t(`maquinaria.mtbfSufijo.${r.mtbfSource}`)}
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {r.horasOperadas !== null
                        ? formatNumber(r.horasOperadas, 0)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatCurrencyARS(r.costoTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
