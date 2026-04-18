"use client";

import { useState, useTransition } from "react";
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
import { StockBadge } from "@/components/inventario/stock-badge";
import {
  MovementDialog,
  type MovementDialogTarget,
} from "@/components/inventario/movement-dialog";
import { formatARS, formatNumber } from "@/lib/format";
import { downloadBase64 } from "@/lib/download";
import { exportarMovimientos } from "@/app/(app)/inventario/actions";

type PerItemMovimiento = {
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
};

export function PerItemMovimientosClient({
  item,
  rows,
  total,
  modulos,
  initialFilters,
}: {
  item: MovementDialogTarget;
  rows: PerItemMovimiento[];
  total: number;
  modulos: string[];
  initialFilters: {
    tipo: string;
    modulo: string;
    desde: string;
    hasta: string;
  };
}) {
  const t = useTranslations("inventario.movimientos");
  const router = useRouter();
  const current = useSearchParams();
  const [movementOpen, setMovementOpen] = useState(false);
  const [isExporting, startExport] = useTransition();

  function handleExport() {
    startExport(async () => {
      try {
        const { base64, filename } = await exportarMovimientos({
          itemId: item.id,
          tipo: initialFilters.tipo,
          modulo: initialFilters.modulo,
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
    router.replace(
      `/inventario/${item.id}/movimientos?${params.toString()}`,
    );
  }

  function clearFilters() {
    router.replace(`/inventario/${item.id}/movimientos`);
  }

  const columns: ColumnDef<PerItemMovimiento>[] = [
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
      accessorKey: "motivo",
      header: t("columnas.motivo"),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.motivo ?? "—"}
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
    !!initialFilters.desde ||
    !!initialFilters.hasta;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/inventario" className="hover:text-foreground">
          {t("breadcrumb")}
        </Link>
        <span>/</span>
        <Link
          href="/inventario/movimientos"
          className="hover:text-foreground"
        >
          {t("titulo")}
        </Link>
      </div>
      <PageHeader
        title={t("tituloItem", { item: item.descripcion })}
        description={
          item.codigo ? t("codigoLabel", { codigo: item.codigo }) : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleExport}
              disabled={isExporting}
            >
              <Download className="size-4" />
              {t("exportar")}
            </Button>
            <Button type="button" onClick={() => setMovementOpen(true)}>
              {t("registrar")}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border border-border p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("kpis.stock")}
          </div>
          <div className="mt-1 text-lg">
            <StockBadge
              stock={item.stock}
              stockMinimo={item.stockMinimo}
              unidad={item.unidadMedida}
            />
          </div>
        </div>
        <div className="rounded-md border border-border p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("kpis.valorUnitario")}
          </div>
          <div className="mt-1 text-lg tabular-nums">
            {formatARS(item.valorUnitario)}
          </div>
        </div>
        <div className="rounded-md border border-border p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("kpis.valorTotal")}
          </div>
          <div className="mt-1 text-lg tabular-nums">
            {formatARS(item.stock * item.valorUnitario)}
          </div>
        </div>
      </div>

      <DataTable<PerItemMovimiento>
        columns={columns}
        data={rows}
        searchableKeys={["motivo", "usuario"]}
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

      <MovementDialog
        target={item}
        open={movementOpen}
        onOpenChange={setMovementOpen}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
