"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { DataTable } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { ActionsMenu } from "@/components/app/actions-menu";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageHeader } from "@/components/app/page-header";
import { Combobox } from "@/components/app/combobox";
import { CurrencyInput } from "@/components/app/currency-input";
import { StockBadge } from "@/components/inventario/stock-badge";
import {
  MovementDialog,
  type MovementDialogTarget,
} from "@/components/inventario/movement-dialog";
import { ImportDrawer } from "@/components/inventario/import-drawer";

import { formatARS, formatNumber } from "@/lib/format";
import { downloadBase64 } from "@/lib/download";

import {
  createItem,
  updateItem,
  deleteItem,
  getRecentMovimientos,
  exportarInventario,
  type RecentMovimiento,
} from "./actions";

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

const CATEGORIA_ALL = "__all__";
const LOCALIDAD_ALL = "__all__";

export function InventarioClient({
  rows,
  categorias,
  localidades,
  unidadesProductivas,
  unidadesMedida,
  isAdmin,
  canRegisterMovimiento,
}: {
  rows: InventarioRow[];
  categorias: string[];
  localidades: string[];
  unidadesProductivas: string[];
  unidadesMedida: string[];
  isAdmin: boolean;
  canRegisterMovimiento: boolean;
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

  const [categoriaFilter, setCategoriaFilter] = useState<string>(CATEGORIA_ALL);
  const [localidadFilter, setLocalidadFilter] = useState<string>(LOCALIDAD_ALL);
  const [bajoMinimoFilter, setBajoMinimoFilter] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [isExporting, startExport] = useTransition();

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: emptyForm,
  });

  const [isSubmitting, startSubmit] = useTransition();

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (categoriaFilter !== CATEGORIA_ALL && r.categoria !== categoriaFilter)
        return false;
      if (localidadFilter !== LOCALIDAD_ALL && r.localidad !== localidadFilter)
        return false;
      if (bajoMinimoFilter && !(r.stockMinimo > 0 && r.stock < r.stockMinimo))
        return false;
      return true;
    });
  }, [rows, categoriaFilter, localidadFilter, bajoMinimoFilter]);

  const bajoMinimoCount = useMemo(
    () =>
      filtered.filter((r) => r.stockMinimo > 0 && r.stock < r.stockMinimo)
        .length,
    [filtered],
  );

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
      accessorKey: "codigo",
      header: t("inventario.campos.codigo"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.codigo || "—"}
        </span>
      ),
    },
    {
      accessorKey: "descripcion",
      header: t("inventario.campos.descripcion"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="font-medium">{row.original.descripcion || "—"}</span>
      ),
    },
    {
      accessorKey: "categoria",
      header: t("inventario.campos.categoria"),
      enableSorting: true,
      cell: ({ row }) =>
        row.original.categoria ?? (
          <span className="text-muted-foreground">—</span>
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
          <span className={v === 0 ? "text-muted-foreground tabular-nums" : "tabular-nums"}>
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

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("inventario.titulo")}
        description={t("inventario.descripcion")}
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

      <DataTable<InventarioRow>
        columns={columns}
        data={filtered}
        searchableKeys={["codigo", "descripcion", "categoria"]}
        searchPlaceholder={t("inventario.buscarPlaceholder")}
        initialSort={[{ id: "descripcion", desc: false }]}
        onRowClick={openDetail}
        filterSlot={
          <div className="flex flex-wrap items-center gap-3">
            <Combobox
              value={categoriaFilter === CATEGORIA_ALL ? "" : categoriaFilter}
              onChange={(v) => setCategoriaFilter(v || CATEGORIA_ALL)}
              options={[
                { value: "", label: t("inventario.filtros.todos") },
                ...categoriaOptions,
              ]}
              placeholder={t("inventario.filtros.categoria")}
              allowCreate={false}
              className="h-9 w-[180px]"
            />
            <Combobox
              value={localidadFilter === LOCALIDAD_ALL ? "" : localidadFilter}
              onChange={(v) => setLocalidadFilter(v || LOCALIDAD_ALL)}
              options={[
                { value: "", label: t("inventario.filtros.todos") },
                ...localidadOptions,
              ]}
              placeholder={t("inventario.filtros.localidad")}
              allowCreate={false}
              className="h-9 w-[180px]"
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="bajo-minimo"
                checked={bajoMinimoFilter}
                onCheckedChange={(v) => setBajoMinimoFilter(v === true)}
              />
              <Label htmlFor="bajo-minimo" className="text-sm font-normal">
                {t("inventario.filtros.bajoMinimo")}
              </Label>
            </div>
            <span className="text-sm text-muted-foreground">
              {t("inventario.resultadosCount", {
                total: filtered.length,
                bajo: bajoMinimoCount,
              })}
            </span>
          </div>
        }
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

      <Sheet
        open={detailOpen}
        onOpenChange={(next) => {
          setDetailOpen(next);
          if (!next) setDetail(null);
        }}
      >
        <SheetContent className="flex w-full flex-col sm:max-w-2xl">
          {detail ? (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="truncate">
                      {detail.descripcion || "—"}
                    </SheetTitle>
                    <SheetDescription className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono">{detail.codigo || "—"}</span>
                      {detail.categoria ? (
                        <span>· {detail.categoria}</span>
                      ) : null}
                      {detail.unidadProductiva ? (
                        <span>· {detail.unidadProductiva}</span>
                      ) : null}
                      {detail.localidad ? (
                        <span>· {detail.localidad}</span>
                      ) : null}
                    </SheetDescription>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {canRegisterMovimiento ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => openMovement(detail)}
                      >
                        {t("inventario.movimientos.registrar")}
                      </Button>
                    ) : null}
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
                  </div>
                </div>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <Tabs defaultValue="resumen" className="w-full">
                  <TabsList>
                    <TabsTrigger value="resumen">Resumen</TabsTrigger>
                    <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
                    <TabsTrigger value="facturas" disabled>
                      Facturas (próximamente)
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="resumen" className="mt-4 space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <KpiCard label={t("inventario.campos.stock")}>
                        <StockBadge
                          stock={detail.stock}
                          stockMinimo={detail.stockMinimo}
                          unidad={detail.unidadMedida}
                        />
                      </KpiCard>
                      <KpiCard label={t("inventario.campos.stockMinimo")}>
                        <span className="tabular-nums">
                          {formatNumber(detail.stockMinimo)}
                          {detail.unidadMedida ? (
                            <span className="ml-1 text-xs text-muted-foreground">
                              {detail.unidadMedida}
                            </span>
                          ) : null}
                        </span>
                      </KpiCard>
                      <KpiCard label={t("inventario.campos.valorUnitario")}>
                        <span className="tabular-nums">
                          {formatARS(detail.valorUnitario)}
                        </span>
                      </KpiCard>
                    </div>
                    <div className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          {t("inventario.campos.valorTotal")}
                        </span>
                        <span className="tabular-nums font-medium">
                          {formatARS(detail.stock * detail.valorUnitario)}
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
                  </TabsContent>

                  <TabsContent value="movimientos" className="mt-4">
                    <RecentMovimientosList
                      loading={recentLoading}
                      movimientos={recentMovs}
                      showModulo
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

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

function KpiCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg">{children}</div>
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
      <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
        Cargando…
      </div>
    );
  }
  if (!movimientos || movimientos.length === 0) {
    return (
      <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
        Sin movimientos registrados.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {movimientos.map((m) => {
        const isEntrada = m.tipo === "entrada";
        return (
          <li
            key={m.id}
            className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {format(m.fecha, "yyyy-MM-dd", { locale: es })}
                </span>
                <span
                  className={
                    isEntrada
                      ? "text-xs font-medium text-foreground"
                      : "text-xs font-medium text-destructive"
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
              <span>
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
