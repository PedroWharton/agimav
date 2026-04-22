"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { format, formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import {
  Plus,
  Upload,
  Download,
  Package,
  AlertTriangle,
  XCircle,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { DataTable } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { ActionsMenu } from "@/components/app/actions-menu";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageHeader } from "@/components/app/page-header";
import { Toolbar } from "@/components/app/toolbar";
import { Combobox } from "@/components/app/combobox";
import { CurrencyInput } from "@/components/app/currency-input";
import { DetailDrawer } from "@/components/app/detail-drawer";
import { StatusChip, type ChipTone } from "@/components/app/status-chip";
import { EmptyState } from "@/components/app/states";
import { KpiCard } from "@/components/stats/kpi-card";
import { StockBadge } from "@/components/inventario/stock-badge";
import {
  MovementDialog,
  type MovementDialogTarget,
} from "@/components/inventario/movement-dialog";
import { ImportDrawer } from "@/components/inventario/import-drawer";

import { formatARS, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { downloadBase64 } from "@/lib/download";

import {
  createItem,
  updateItem,
  deleteItem,
  getRecentMovimientos,
  exportarInventario,
} from "./actions";
import type { RecentMovimiento } from "./types";

export type InventarioRow = {
  id: number;
  codigo: string;
  descripcion: string;
  categoria: string | null;
  localidad: string | null;
  unidadProductiva: string | null;
  unidadMedida: string | null;
  stock: number;
  stockMinimo: number;
  valorUnitario: number;
};

export type InventarioKpis = {
  total: number;
  bajoMinimo: number;
  stockNegativo: number;
  valorTotal: number;
};

type StockEstadoKey = "ok" | "bajo" | "negativo" | "cero";

function stockEstado(row: InventarioRow): StockEstadoKey {
  if (row.stock < 0) return "negativo";
  if (row.stockMinimo > 0 && row.stock < row.stockMinimo) return "bajo";
  if (row.stock === 0 && row.stockMinimo === 0) return "cero";
  return "ok";
}

const ESTADO_TONES: Record<StockEstadoKey, ChipTone> = {
  ok: "ok",
  bajo: "warn",
  negativo: "danger",
  cero: "neutral",
};

const formSchema = z.object({
  codigo: z.string().trim().min(1, "Obligatorio").max(50),
  descripcion: z.string().trim().min(1, "Obligatorio").max(300),
  categoria: z.string().trim().max(100).optional(),
  localidad: z.string().trim().max(100).optional(),
  unidadProductiva: z.string().trim().max(100).optional(),
  unidadMedida: z.string().trim().max(50).optional(),
  stockMinimo: z.number().nonnegative(),
  valorUnitario: z.number().nonnegative(),
});
type FormValues = z.infer<typeof formSchema>;

const emptyForm: FormValues = {
  codigo: "",
  descripcion: "",
  categoria: "",
  localidad: "",
  unidadProductiva: "",
  unidadMedida: "",
  stockMinimo: 0,
  valorUnitario: 0,
};

function rowToForm(row: InventarioRow): FormValues {
  return {
    codigo: row.codigo,
    descripcion: row.descripcion,
    categoria: row.categoria ?? "",
    localidad: row.localidad ?? "",
    unidadProductiva: row.unidadProductiva ?? "",
    unidadMedida: row.unidadMedida ?? "",
    stockMinimo: row.stockMinimo,
    valorUnitario: row.valorUnitario,
  };
}

function toOptions(values: readonly string[]) {
  return values.map((v) => ({ value: v, label: v }));
}

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function formatARSShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `$${(value / 1_000_000).toLocaleString("es-AR", {
      maximumFractionDigits: 1,
    })}M`;
  }
  if (abs >= 1_000) {
    return `$${(value / 1_000).toLocaleString("es-AR", {
      maximumFractionDigits: 1,
    })}k`;
  }
  return formatARS(value);
}

const CATEGORIA_ALL = "__all__";
const LOCALIDAD_ALL = "__all__";

type EstadoPill = "todos" | "ok" | "bajo" | "negativo";

function categoriaHue(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const tones = [
    "bg-sky-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-rose-500",
    "bg-violet-500",
    "bg-teal-500",
    "bg-orange-500",
    "bg-fuchsia-500",
  ] as const;
  return tones[h % tones.length]!;
}

export function InventarioClient({
  rows,
  categorias,
  localidades,
  unidadesProductivas,
  unidadesMedida,
  isAdmin,
  canRegisterMovimiento,
  kpis,
  lastMovimientoAt,
}: {
  rows: InventarioRow[];
  categorias: string[];
  localidades: string[];
  unidadesProductivas: string[];
  unidadesMedida: string[];
  isAdmin: boolean;
  canRegisterMovimiento: boolean;
  kpis: InventarioKpis;
  lastMovimientoAt: Date | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<InventarioRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<InventarioRow | null>(null);
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementTarget, setMovementTarget] =
    useState<MovementDialogTarget | null>(null);
  const [recentMovs, setRecentMovs] = useState<RecentMovimiento[] | null>(null);
  const [recentLoading, setRecentLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState<string>(CATEGORIA_ALL);
  const [localidadFilter, setLocalidadFilter] = useState<string>(LOCALIDAD_ALL);
  const [estadoPill, setEstadoPill] = useState<EstadoPill>("todos");
  const [importOpen, setImportOpen] = useState(false);
  const [isExporting, startExport] = useTransition();

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: emptyForm,
  });

  const [isSubmitting, startSubmit] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim();
    const qn = q ? norm(q) : "";
    return rows.filter((r) => {
      if (categoriaFilter !== CATEGORIA_ALL && r.categoria !== categoriaFilter)
        return false;
      if (localidadFilter !== LOCALIDAD_ALL && r.localidad !== localidadFilter)
        return false;
      if (estadoPill !== "todos") {
        const est = stockEstado(r);
        if (estadoPill === "ok" && est !== "ok") return false;
        if (estadoPill === "bajo" && est !== "bajo") return false;
        if (estadoPill === "negativo" && est !== "negativo") return false;
      }
      if (qn) {
        if (
          !(
            norm(r.codigo).includes(qn) ||
            norm(r.descripcion).includes(qn) ||
            norm(r.categoria).includes(qn)
          )
        )
          return false;
      }
      return true;
    });
  }, [rows, search, categoriaFilter, localidadFilter, estadoPill]);

  function openCreate() {
    setEditing(null);
    form.reset(emptyForm);
    setEditOpen(true);
  }

  function openEdit(row: InventarioRow) {
    setEditing(row);
    form.reset(rowToForm(row));
    setEditOpen(true);
  }

  function openDetail(row: InventarioRow) {
    setDetail(row);
    setRecentMovs(null);
    setRecentLoading(true);
    setDetailOpen(true);
  }

  function openMovement(row: InventarioRow) {
    setMovementTarget({
      id: row.id,
      codigo: row.codigo,
      descripcion: row.descripcion,
      stock: row.stock,
      stockMinimo: row.stockMinimo,
      valorUnitario: row.valorUnitario,
      unidadMedida: row.unidadMedida,
    });
    setMovementOpen(true);
  }

  function handleMovementSuccess() {
    router.refresh();
    if (detail) {
      setRecentLoading(true);
      getRecentMovimientos(detail.id, 10).then((data) => {
        setRecentMovs(data);
        setRecentLoading(false);
      });
    }
  }

  useEffect(() => {
    if (!detailOpen || !detail) return;
    let cancelled = false;
    getRecentMovimientos(detail.id, 10)
      .then((data) => {
        if (!cancelled) {
          setRecentMovs(data);
          setRecentLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setRecentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailOpen, detail]);

  function submit() {
    form.handleSubmit((values) => {
      startSubmit(async () => {
        const payload = {
          codigo: values.codigo,
          descripcion: values.descripcion,
          categoria: values.categoria ?? "",
          localidad: values.localidad ?? "",
          unidadProductiva: values.unidadProductiva ?? "",
          unidadMedida: values.unidadMedida ?? "",
          stockMinimo: values.stockMinimo,
          valorUnitario: values.valorUnitario,
        };
        const result = editing
          ? await updateItem(editing.id, payload)
          : await createItem(payload);
        if (result.ok) {
          toast.success(
            editing
              ? t("listados.common.actualizadoExitoso", {
                  entidad: t("inventario.singular"),
                  nombre: values.descripcion,
                })
              : t("listados.common.creadoExitoso", {
                  entidad: t("inventario.singular"),
                  nombre: values.descripcion,
                }),
          );
          setEditOpen(false);
        } else if (result.error === "invalid" && result.fieldErrors) {
          for (const [k, msg] of Object.entries(result.fieldErrors)) {
            form.setError(k as keyof FormValues, { message: msg });
          }
        } else if (result.error === "duplicate_codigo") {
          form.setError("codigo", {
            message: t("inventario.avisos.codigoDuplicado", {
              codigo: values.codigo,
            }),
          });
        } else if (result.error === "forbidden") {
          toast.error(t("listados.common.errorForbidden"));
        } else {
          toast.error(t("listados.common.errorGuardar"));
        }
      });
    })();
  }

  async function onDelete(row: InventarioRow) {
    const result = await deleteItem(row.id);
    if (result.ok) {
      toast.success(
        t("listados.common.eliminadoExitoso", {
          entidad: t("inventario.singular"),
          nombre: row.descripcion,
        }),
      );
      if (detail?.id === row.id) setDetailOpen(false);
    } else if (result.error === "in_use_movs") {
      toast.error(
        t("inventario.avisos.eliminarEnUsoMovs", { count: result.count ?? 0 }),
      );
    } else if (result.error === "in_use_refs") {
      toast.error(t("inventario.avisos.eliminarEnUsoRefs"));
    } else if (result.error === "forbidden") {
      toast.error(t("listados.common.errorForbidden"));
    } else {
      toast.error(t("listados.common.errorGuardar"));
    }
  }

  const columns: ColumnDef<InventarioRow>[] = [
    {
      accessorKey: "descripcion",
      header: t("inventario.campos.item"),
      enableSorting: true,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-mono text-[11px] text-muted-foreground">
            {row.original.codigo || "—"}
          </span>
          <span className="text-sm font-medium">
            {row.original.descripcion || "—"}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "categoria",
      header: t("inventario.campos.categoria"),
      enableSorting: true,
      cell: ({ row }) => {
        const c = row.original.categoria;
        if (!c) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-[11.5px] font-medium text-foreground">
            <span
              className={`size-1.5 rounded-full ${categoriaHue(c)}`}
              aria-hidden="true"
            />
            {c}
          </span>
        );
      },
    },
    {
      accessorKey: "localidad",
      header: t("inventario.campos.localidad"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.localidad ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "stock",
      header: t("inventario.campos.stock"),
      enableSorting: true,
      cell: ({ row }) => (
        <StockBadge
          stock={row.original.stock}
          stockMinimo={row.original.stockMinimo}
          unidad={row.original.unidadMedida}
        />
      ),
    },
    {
      accessorKey: "valorUnitario",
      header: t("inventario.campos.valorUnitario"),
      enableSorting: true,
      cell: ({ row }) => {
        const v = row.original.valorUnitario;
        return (
          <span
            className={
              v === 0
                ? "text-muted-foreground tabular-nums"
                : "tabular-nums"
            }
          >
            {formatARS(v)}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        if (!canRegisterMovimiento && !isAdmin) return null;
        const item = row.original;
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <ActionsMenu>
              {canRegisterMovimiento ? (
                <DropdownMenuItem onClick={() => openMovement(item)}>
                  {t("inventario.movimientos.registrar")}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem asChild>
                <Link href={`/inventario/${item.id}/movimientos`}>
                  {t("inventario.movimientos.verHistorial")}
                </Link>
              </DropdownMenuItem>
              {isAdmin ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openEdit(item)}>
                    {t("listados.common.editar")}
                  </DropdownMenuItem>
                  <ConfirmDialog
                    trigger={
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        className="text-destructive focus:text-destructive"
                      >
                        {t("listados.common.eliminar")}
                      </DropdownMenuItem>
                    }
                    title={t("inventario.avisos.eliminarPregunta", {
                      nombre: item.descripcion,
                    })}
                    description="Si el item tiene movimientos o está referenciado en otros módulos, no podrá eliminarse."
                    confirmLabel={t("listados.common.eliminar")}
                    destructive
                    onConfirm={() => onDelete(item)}
                  />
                </>
              ) : null}
            </ActionsMenu>
          </div>
        );
      },
    },
  ];

  const title = editing
    ? t("inventario.editarItem")
    : t("inventario.nuevoItem");

  const categoriaOptions = toOptions(categorias);
  const localidadOptions = toOptions(localidades);
  const unidadesProductivasOptions = toOptions(unidadesProductivas);
  const unidadesMedidaOptions = toOptions(unidadesMedida);

  const detailEstado: StockEstadoKey | null = detail ? stockEstado(detail) : null;

  const lastMovDescription = lastMovimientoAt
    ? `${rows.length.toLocaleString("es-AR")} items · última actualización ${formatDistanceToNowStrict(
        lastMovimientoAt,
        { addSuffix: true, locale: es },
      )}`
    : `${rows.length.toLocaleString("es-AR")} items · ${t("inventario.descripcion")}`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("inventario.titulo")}
        description={lastMovDescription}
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                startExport(async () => {
                  try {
                    const { base64, filename } = await exportarInventario();
                    downloadBase64(base64, filename);
                  } catch {
                    toast.error(t("inventario.exportarError"));
                  }
                })
              }
              disabled={isExporting}
            >
              <Download className="size-4" />
              {t("inventario.exportar")}
            </Button>
            {isAdmin ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="size-4" />
                {t("inventario.importar.titulo")}
              </Button>
            ) : null}
            {isAdmin ? (
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                {t("inventario.nuevoItem")}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={Package}
          tone="neutral"
          label={t("inventario.kpis.items")}
          value={kpis.total.toLocaleString("es-AR")}
          caption={t("inventario.kpis.itemsCaption")}
        />
        <KpiCard
          icon={AlertTriangle}
          tone={kpis.bajoMinimo > 0 ? "warn" : "neutral"}
          label={t("inventario.kpis.bajoMinimo")}
          value={kpis.bajoMinimo.toLocaleString("es-AR")}
          caption={t("inventario.kpis.bajoMinimoCaption", {
            count: kpis.bajoMinimo,
          })}
        />
        <KpiCard
          icon={XCircle}
          tone={kpis.stockNegativo > 0 ? "danger" : "neutral"}
          label={t("inventario.kpis.stockNegativo")}
          value={kpis.stockNegativo.toLocaleString("es-AR")}
          caption={t("inventario.kpis.stockNegativoCaption", {
            count: kpis.stockNegativo,
          })}
        />
        <KpiCard
          icon={DollarSign}
          tone="neutral"
          label={t("inventario.kpis.valorTotal")}
          value={formatARSShort(kpis.valorTotal)}
          caption={t("inventario.kpis.valorTotalCaption")}
        />
      </div>

      <Toolbar>
        <Toolbar.Search
          value={search}
          onValueChange={setSearch}
          placeholder={t("inventario.buscarPlaceholder")}
        />
        <Toolbar.Selects>
          <Select
            value={categoriaFilter}
            onValueChange={(v) => setCategoriaFilter(v || CATEGORIA_ALL)}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder={t("inventario.filtros.categoria")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CATEGORIA_ALL}>
                {t("inventario.filtros.todos")}
              </SelectItem>
              {categoriaOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={localidadFilter}
            onValueChange={(v) => setLocalidadFilter(v || LOCALIDAD_ALL)}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder={t("inventario.filtros.localidad")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={LOCALIDAD_ALL}>
                {t("inventario.filtros.todos")}
              </SelectItem>
              {localidadOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Toolbar.Selects>
        <Toolbar.Pills>
          <EstadoToggle
            current={estadoPill}
            value="ok"
            tone="ok"
            label={t("inventario.filtros.stockOk")}
            onClick={setEstadoPill}
          />
          <EstadoToggle
            current={estadoPill}
            value="bajo"
            tone="warn"
            label={t("inventario.filtros.bajoMinimo")}
            count={kpis.bajoMinimo}
            onClick={setEstadoPill}
          />
          <EstadoToggle
            current={estadoPill}
            value="negativo"
            tone="danger"
            label={t("inventario.filtros.stockNegativo")}
            count={kpis.stockNegativo}
            onClick={setEstadoPill}
          />
        </Toolbar.Pills>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {t("inventario.resultadosCount", { total: filtered.length })}
        </span>
      </Toolbar>

      <DataTable<InventarioRow>
        columns={columns}
        data={filtered}
        initialSort={[{ id: "descripcion", desc: false }]}
        onRowClick={openDetail}
        emptyState={
          isAdmin
            ? t("inventario.avisos.vacioAdmin")
            : t("inventario.avisos.vacio")
        }
      />

      <FormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        title={title}
        isDirty={form.formState.isDirty}
        isSubmitting={isSubmitting}
        onSubmit={submit}
      >
        <Form {...form}>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="codigo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("inventario.campos.codigo")} *</FormLabel>
                  <FormControl>
                    <Input {...field} autoFocus className="font-mono" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unidadMedida"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("inventario.campos.unidadMedida")}</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      options={unidadesMedidaOptions}
                      placeholder="—"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="descripcion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("inventario.campos.descripcion")} *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="categoria"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("inventario.campos.categoria")}</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      options={categoriaOptions}
                      placeholder="—"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="localidad"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("inventario.campos.localidad")}</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      options={localidadOptions}
                      placeholder="—"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="unidadProductiva"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("inventario.campos.unidadProductiva")}
                </FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    options={unidadesProductivasOptions}
                    placeholder="—"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="stockMinimo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("inventario.campos.stockMinimo")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min={0}
                      className="tabular-nums"
                      value={field.value}
                      onChange={(e) => {
                        const raw = e.target.value;
                        field.onChange(raw === "" ? 0 : Number(raw));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="valorUnitario"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("inventario.campos.valorUnitario")}</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value}
                      onChange={(v) => field.onChange(v === "" ? 0 : v)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {editing ? (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("inventario.campos.stock")}
                </span>
                <StockBadge
                  stock={editing.stock}
                  stockMinimo={editing.stockMinimo}
                  unidad={editing.unidadMedida}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("inventario.avisos.stockSoloMovimientos")}
              </p>
            </div>
          ) : null}
        </Form>
      </FormSheet>

      <DetailDrawer
        open={detailOpen}
        onOpenChange={(next) => {
          setDetailOpen(next);
          if (!next) setDetail(null);
        }}
        width="lg"
        title={detail ? (detail.descripcion || "—") : ""}
        subtitle={
          detail ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono">{detail.codigo || "—"}</span>
              {detail.categoria ? <span>· {detail.categoria}</span> : null}
              {detail.unidadProductiva ? (
                <span>· {detail.unidadProductiva}</span>
              ) : null}
              {detail.localidad ? <span>· {detail.localidad}</span> : null}
              {detailEstado ? (
                <StatusChip
                  tone={ESTADO_TONES[detailEstado]}
                  label={t(`inventario.estado.${detailEstado}`)}
                  dot
                  className="ml-1"
                />
              ) : null}
            </div>
          ) : null
        }
        footer={
          detail ? (
            <>
              {isAdmin ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDetailOpen(false);
                    openEdit(detail);
                  }}
                >
                  {t("listados.common.editar")}
                </Button>
              ) : null}
              {canRegisterMovimiento ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => openMovement(detail)}
                >
                  {t("inventario.movimientos.registrar")}
                </Button>
              ) : null}
            </>
          ) : null
        }
        tabs={
          detail
            ? [
                {
                  id: "resumen",
                  label: t("inventario.tabs.resumen"),
                  content: (
                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-3 gap-3">
                        <MiniKpi label={t("inventario.campos.stock")}>
                          <StockBadge
                            stock={detail.stock}
                            stockMinimo={detail.stockMinimo}
                            unidad={detail.unidadMedida}
                          />
                        </MiniKpi>
                        <MiniKpi label={t("inventario.campos.stockMinimo")}>
                          <span className="tabular-nums">
                            {formatNumber(detail.stockMinimo)}
                            {detail.unidadMedida ? (
                              <span className="ml-1 text-xs text-muted-foreground">
                                {detail.unidadMedida}
                              </span>
                            ) : null}
                          </span>
                        </MiniKpi>
                        <MiniKpi label={t("inventario.campos.valorUnitario")}>
                          <span className="tabular-nums">
                            {formatARS(detail.valorUnitario)}
                          </span>
                        </MiniKpi>
                      </div>
                      <div className="rounded-lg border border-border bg-muted-2/60 p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            {t("inventario.campos.valorTotal")}
                          </span>
                          <span className="tabular-nums font-medium">
                            {formatARS(
                              Math.max(detail.stock, 0) * detail.valorUnitario,
                            )}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <h3 className="text-sm font-medium">
                            {t("inventario.movimientos.ultimos")}
                          </h3>
                          <Link
                            href={`/inventario/${detail.id}/movimientos`}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            {t("inventario.movimientos.verTodo")} →
                          </Link>
                        </div>
                        <RecentMovimientosList
                          loading={recentLoading}
                          movimientos={recentMovs}
                        />
                      </div>
                    </div>
                  ),
                },
                {
                  id: "movimientos",
                  label: t("inventario.tabs.movimientos"),
                  content: (
                    <RecentMovimientosList
                      loading={recentLoading}
                      movimientos={recentMovs}
                      showModulo
                    />
                  ),
                },
                {
                  id: "facturas",
                  label: t("inventario.tabs.facturas"),
                  content: (
                    <EmptyState
                      variant="empty-tab"
                      title={t("inventario.avisosDetail.facturasNoDisponible")}
                      description={t(
                        "inventario.avisosDetail.facturasPronto",
                      )}
                    />
                  ),
                },
              ]
            : undefined
        }
      />

      <MovementDialog
        target={movementTarget}
        open={movementOpen}
        onOpenChange={(next) => {
          setMovementOpen(next);
          if (!next) setMovementTarget(null);
        }}
        onSuccess={handleMovementSuccess}
      />

      <ImportDrawer open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function EstadoToggle({
  current,
  value,
  label,
  tone,
  count,
  onClick,
}: {
  current: EstadoPill;
  value: Exclude<EstadoPill, "todos">;
  label: string;
  tone: ChipTone;
  count?: number;
  onClick: (next: EstadoPill) => void;
}) {
  const active = current === value;
  const countTone: Record<ChipTone, string> = {
    neutral: "text-muted-foreground",
    ok: "text-success",
    warn: "text-warn",
    danger: "text-danger",
    info: "text-info",
  };
  const base =
    "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium cursor-pointer transition-colors bg-muted hover:bg-muted-2";
  const stateStyles = active
    ? "border-foreground/25 ring-1 ring-foreground/15 text-foreground"
    : "border-transparent text-muted-foreground";
  return (
    <button
      type="button"
      onClick={() => onClick(active ? "todos" : value)}
      className={cn(base, stateStyles)}
      aria-pressed={active}
    >
      {label}
      {typeof count === "number" && count > 0 ? (
        <span className={cn("font-mono text-[11px]", countTone[tone])}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

function MiniKpi({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg leading-tight">{children}</div>
    </div>
  );
}

function RecentMovimientosList({
  loading,
  movimientos,
  showModulo,
}: {
  loading: boolean;
  movimientos: RecentMovimiento[] | null;
  showModulo?: boolean;
}) {
  if (loading && !movimientos) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        Cargando…
      </div>
    );
  }
  if (!movimientos || movimientos.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted-2/40 p-4 text-sm text-muted-foreground">
        Sin movimientos registrados.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {movimientos.map((m) => {
        const isEntrada = m.tipo === "entrada";
        return (
          <li
            key={m.id}
            className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums font-mono">
                  {format(m.fecha, "yyyy-MM-dd", { locale: es })}
                </span>
                <span
                  className={
                    "text-[10.5px] font-semibold uppercase tracking-wide " +
                    (isEntrada ? "text-success" : "text-danger")
                  }
                >
                  {m.tipo}
                </span>
                {showModulo && m.moduloOrigen ? (
                  <span className="text-xs text-muted-foreground">
                    · {m.moduloOrigen}
                    {m.idOrigen ? ` #${m.idOrigen}` : ""}
                  </span>
                ) : null}
              </div>
              {m.motivo ? (
                <div className="truncate text-xs text-muted-foreground">
                  {m.motivo}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-3 text-xs tabular-nums">
              <span
                className={
                  "font-medium " +
                  (isEntrada ? "text-success" : "text-danger")
                }
              >
                {isEntrada ? "+" : "−"}
                {formatNumber(m.cantidad)}
                {m.unidadMedida ? ` ${m.unidadMedida}` : ""}
              </span>
              <span className="text-muted-foreground">
                {formatARS(m.valorUnitario)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
