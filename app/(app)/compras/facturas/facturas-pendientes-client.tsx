"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Combobox } from "@/components/app/combobox";
import { EmptyState } from "@/components/app/states";
import { Toolbar } from "@/components/app/toolbar";

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
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left font-medium w-28">
                {tFac("pendientes.columnas.oc")}
              </th>
              <th className="px-2 py-2 text-left font-medium w-28">
                {tFac("pendientes.columnas.fechaEmision")}
              </th>
              <th className="px-2 py-2 text-left font-medium">
                {tFac("pendientes.columnas.proveedor")}
              </th>
              <th className="px-2 py-2 text-left font-medium w-40">
                {tFac("pendientes.columnas.estado")}
              </th>
              <th className="px-2 py-2 text-right font-medium w-28">
                {tFac("pendientes.columnas.pendientes")}
              </th>
              <th className="px-2 py-2 text-left font-medium w-36">
                {tFac("pendientes.columnas.ultimaRecepcion")}
              </th>
              <th className="px-2 py-2 text-right font-medium w-40">
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
                  colSpan={7}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  {tFac("avisos.vacioFiltrado")}
                </td>
              </tr>
            ) : null}
            {filtered.map((oc) => (
              <tr
                key={oc.id}
                className="cursor-pointer border-t border-border hover:bg-muted/20"
                onClick={() =>
                  router.push(`/compras/facturas/nueva?oc=${oc.id}`)
                }
              >
                <td className="px-2 py-2 font-mono text-xs">
                  <Link
                    href={`/compras/oc/${oc.id}`}
                    className="underline-offset-2 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {oc.numeroOc}
                  </Link>
                </td>
                <td className="px-2 py-2 text-xs tabular-nums text-muted-foreground">
                  {format(new Date(oc.fechaEmision), "dd/MM/yyyy", {
                    locale: es,
                  })}
                </td>
                <td className="px-2 py-2">{oc.proveedor}</td>
                <td className="px-2 py-2">
                  <Badge
                    variant="secondary"
                    className="border-transparent bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200"
                  >
                    {oc.estado}
                  </Badge>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {oc.lineasPendientes} / {oc.totalLineas}
                </td>
                <td className="px-2 py-2 text-xs tabular-nums text-muted-foreground">
                  {oc.fechaUltimaRecepcion
                    ? format(new Date(oc.fechaUltimaRecepcion), "dd/MM/yyyy", {
                        locale: es,
                      })
                    : "—"}
                </td>
                <td
                  className="px-2 py-2 text-right"
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
