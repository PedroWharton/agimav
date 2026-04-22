"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { FileText } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { Combobox } from "@/components/app/combobox";
import { EmptyState } from "@/components/app/states";
import { Toolbar } from "@/components/app/toolbar";
import { EstadoChip } from "@/components/compras/estado-chip";

export type FacturaPendienteOc = {
  id: number;
  numeroOc: string;
  fechaEmision: string;
  estado: string;
  proveedor: string;
  lineasPendientes: number;
  totalLineas: number;
  recepcionesCount: number;
  fechaUltimaRecepcion: string | null;
};

const PROV_ALL = "__all__";

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function FacturasPendientesClient({
  ocs,
  proveedores,
}: {
  ocs: FacturaPendienteOc[];
  proveedores: string[];
}) {
  const tFac = useTranslations("compras.facturas");
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [provFilter, setProvFilter] = useState<string>(PROV_ALL);

  const filtered = useMemo(() => {
    const q = norm(search.trim());
    return ocs.filter((oc) => {
      if (provFilter !== PROV_ALL && oc.proveedor !== provFilter) return false;
      if (q) {
        const hay =
          norm(oc.numeroOc).includes(q) || norm(oc.proveedor).includes(q);
        if (!hay) return false;
      }
      return true;
    });
  }, [ocs, search, provFilter]);

  if (ocs.length === 0) {
    return (
      <EmptyState
        variant="no-data"
        title={tFac("pendientes.vacio.titulo")}
        description={tFac("pendientes.vacio.descripcion")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <Toolbar.Search
          value={search}
          onValueChange={setSearch}
          placeholder={tFac("pendientes.buscarPlaceholder")}
        />
        <Toolbar.Selects>
          <Combobox
            value={provFilter === PROV_ALL ? "" : provFilter}
            onChange={(v) => setProvFilter(v || PROV_ALL)}
            options={[
              { value: "", label: tFac("filtros.todos") },
              ...proveedores.map((p) => ({ value: p, label: p })),
            ]}
            placeholder={tFac("filtros.proveedor")}
            allowCreate={false}
            className="h-9 w-[240px]"
          />
        </Toolbar.Selects>
      </Toolbar>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium w-40">
                {tFac("pendientes.columnas.oc")}
              </th>
              <th className="px-3 py-2.5 text-left font-medium">
                {tFac("pendientes.columnas.proveedor")}
              </th>
              <th className="px-3 py-2.5 text-left font-medium w-40">
                {tFac("pendientes.columnas.estado")}
              </th>
              <th className="px-3 py-2.5 text-left font-medium w-44">
                {tFac("pendientes.columnas.pendientes")}
              </th>
              <th className="px-3 py-2.5 text-right font-medium w-40">
                <span className="sr-only">
                  {tFac("pendientes.acciones.crear")}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  {tFac("avisos.vacioFiltrado")}
                </td>
              </tr>
            ) : null}
            {filtered.map((oc) => {
              const facturadas = oc.totalLineas - oc.lineasPendientes;
              const pct =
                oc.totalLineas > 0
                  ? (facturadas / oc.totalLineas) * 100
                  : 0;
              return (
                <tr
                  key={oc.id}
                  className="cursor-pointer border-t border-border transition-colors hover:bg-muted/20"
                  onClick={() =>
                    router.push(`/compras/facturas/nueva?oc=${oc.id}`)
                  }
                >
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/compras/oc/${oc.id}`}
                      className="flex flex-col underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="font-mono text-xs font-medium">
                        {oc.numeroOc}
                      </span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {oc.fechaUltimaRecepcion
                          ? tFac("pendientes.ultimaRecepcionInline", {
                              fecha: format(
                                new Date(oc.fechaUltimaRecepcion),
                                "dd/MM/yyyy",
                                { locale: es },
                              ),
                            })
                          : format(new Date(oc.fechaEmision), "dd/MM/yyyy", {
                              locale: es,
                            })}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-sm">{oc.proveedor}</td>
                  <td className="px-3 py-2.5">
                    <EstadoChip estado={oc.estado} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs tabular-nums">
                          {oc.lineasPendientes} pend. / {oc.totalLineas}
                        </span>
                        <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            pct >= 99.99
                              ? "bg-emerald-500"
                              : pct > 0
                                ? "bg-sky-500"
                                : "bg-muted",
                          )}
                          style={{
                            width: `${Math.min(100, Math.max(0, pct))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td
                    className="px-3 py-2.5 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button asChild size="sm">
                      <Link href={`/compras/facturas/nueva?oc=${oc.id}`}>
                        <FileText className="size-4" />
                        {tFac("pendientes.acciones.crear")}
                      </Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
