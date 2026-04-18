"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

import { DataTable } from "@/components/app/data-table";
import { PageHeader } from "@/components/app/page-header";
import { formatARS, formatNumber } from "@/lib/format";
import { downloadBase64 } from "@/lib/download";
import { exportarMovimientos } from "@/app/(app)/inventario/actions";

export type MovimientoRow = {
  id: number;
  fecha: Date;
  tipo: string;
  cantidad: number;
  valorUnitario: number;
  unidadMedida: string | null;
  moduloOrigen: string | null;
  idOrigen: number | null;
  motivo: string | null;
  usuario: string;
  itemId: number;
  itemCodigo: string | null;
  itemDescripcion: string | null;
};

export type MovimientosFilters = {
  tipo: string;
  modulo: string;
  itemId: string;
  desde: string;
  hasta: string;
};

export function MovimientosClient({
  rows,
  total,
  modulos,
  initialFilters,
}: {
  rows: MovimientoRow[];
  total: number;
  modulos: string[];
  initialFilters: MovimientosFilters;
}) {
  const t = useTranslations("inventario.movimientos");
  const router = useRouter();
  const current = useSearchParams();
  const [isExporting, startExport] = useTransition();

  function handleExport() {
    startExport(async () => {
      try {
        const { base64, filename } = await exportarMovimientos({
          tipo: initialFilters.tipo,
          modulo: initialFilters.modulo,
          itemId: initialFilters.itemId
            ? Number(initialFilters.itemId)
            : undefined,
          desde: initialFilters.desde || undefined,
          hasta: initialFilters.hasta || undefined,
        });
        downloadBase64(base64, filename);
      } catch {
        toast.error(t("exportarError"));
      }
    });
  }

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(current?.toString() ?? "");
    if (!value || value === "todos") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.replace(`/inventario/movimientos?${params.toString()}`);
  }

  function clearFilters() {
    router.replace("/inventario/movimientos");
  }

  const columns: ColumnDef<MovimientoRow>[] = [
    {
      accessorKey: "fecha",
      header: t("columnas.fecha"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums text-xs text-muted-foreground">
          {format(row.original.fecha, "yyyy-MM-dd")}
        </span>
      ),
    },
    {
      accessorKey: "itemDescripcion",
      header: t("columnas.item"),
      enableSorting: true,
      cell: ({ row }) => (
        <Link
          href={`/inventario/${row.original.itemId}/movimientos`}
          className="hover:underline"
        >
          <div className="font-mono text-xs text-muted-foreground">
            {row.original.itemCodigo ?? "—"}
          </div>
          <div className="truncate">
            {row.original.itemDescripcion ?? "—"}
          </div>
        </Link>
      ),
    },
    {
      accessorKey: "tipo",
      header: t("columnas.tipo"),
      enableSorting: true,
      cell: ({ row }) => {
        const isEntrada = row.original.tipo === "entrada";
        return (
          <span
            className={
              isEntrada
                ? "text-xs font-medium"
                : "text-xs font-medium text-destructive"
            }
          >
            {row.original.tipo}
          </span>
        );
      },
    },
    {
      accessorKey: "cantidad",
      header: t("columnas.cantidad"),
      enableSorting: true,
      cell: ({ row }) => {
        const isEntrada = row.original.tipo === "entrada";
        const sign = row.original.cantidad === 0 ? "" : isEntrada ? "+" : "−";
        return (
          <span className="tabular-nums">
            {sign}
            {formatNumber(row.original.cantidad)}
            {row.original.unidadMedida ? (
              <span className="ml-1 text-xs text-muted-foreground">
                {row.original.unidadMedida}
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      accessorKey: "valorUnitario",
      header: t("columnas.valorUnitario"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">
          {formatARS(row.original.valorUnitario)}
        </span>
      ),
    },
    {
      accessorKey: "moduloOrigen",
      header: t("columnas.origen"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.moduloOrigen ?? "—"}
          {row.original.idOrigen ? ` #${row.original.idOrigen}` : ""}
        </span>
      ),
    },
    {
      accessorKey: "usuario",
      header: t("columnas.usuario"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.usuario}
        </span>
      ),
    },
  ];

  const hasFilters =
    initialFilters.tipo !== "todos" ||
    initialFilters.modulo !== "todos" ||
    !!initialFilters.itemId ||
    !!initialFilters.desde ||
    !!initialFilters.hasta;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("titulo")}
        description={t("descripcion")}
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download className="size-4" />
            {t("exportar")}
          </Button>
        }
      />

      <DataTable<MovimientoRow>
        columns={columns}
        data={rows}
        searchableKeys={["itemCodigo", "itemDescripcion", "motivo", "usuario"]}
        initialSort={[{ id: "fecha", desc: true }]}
        filterSlot={
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">
                {t("filtros.tipo")}
              </Label>
              <Select
                value={initialFilters.tipo}
                onValueChange={(v) => setParam("tipo", v)}
              >
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">{t("todos")}</SelectItem>
                  <SelectItem value="entrada">{t("tipos.entrada")}</SelectItem>
                  <SelectItem value="salida">{t("tipos.salida")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">
                {t("filtros.modulo")}
              </Label>
              <Select
                value={initialFilters.modulo}
                onValueChange={(v) => setParam("modulo", v)}
              >
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">{t("todos")}</SelectItem>
                  {modulos.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">
                {t("filtros.desde")}
              </Label>
              <Input
                type="date"
                className="h-9 w-[150px]"
                defaultValue={initialFilters.desde}
                onBlur={(e) => setParam("desde", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">
                {t("filtros.hasta")}
              </Label>
              <Input
                type="date"
                className="h-9 w-[150px]"
                defaultValue={initialFilters.hasta}
                onBlur={(e) => setParam("hasta", e.target.value)}
              />
            </div>
            {hasFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
              >
                {t("limpiar")}
              </Button>
            ) : null}
            <span className="text-sm text-muted-foreground">
              {t("total", { count: total })}
            </span>
          </div>
        }
        emptyState={t("sinMovimientos")}
      />
    </div>
  );
}
