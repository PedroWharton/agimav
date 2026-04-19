"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Columns3, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  useForm,
  type ControllerRenderProps,
  type UseFormReturn,
} from "react-hook-form";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { DataTable } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { ActionsMenu } from "@/components/app/actions-menu";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageHeader } from "@/components/app/page-header";
import { Combobox, type ComboboxOption } from "@/components/app/combobox";
import { cn } from "@/lib/utils";

import {
  createMaquinaria,
  updateMaquinaria,
  deleteMaquinaria,
} from "./actions";
import { saveColumnConfig } from "./column-actions";

export type AtributoDef = {
  id: number;
  nombre: string;
  dataType: string;
  requerido: boolean;
  esPrincipal: boolean;
  sourceRef: string | null;
  listOptions: string | null;
  activo: boolean;
};

export type NivelDef = {
  id: number;
  nombre: string;
  parentLevelId: number | null;
  orden: number;
  atributos: AtributoDef[];
};

export type MaquinaRow = {
  id: number;
  nroSerie: string | null;
  estado: string;
  horasAcumuladas: number;
  createdAt: string; // ISO
  values: Record<number, string>; // atributoId → valueText
  niveles: Array<{
    nivelId: number;
    atributos: Array<{ atributoId: number; valueText: string }>;
  }>;
};

export type TipoOption = { id: number; nombre: string };

export type RefSources = {
  unidades_productivas: string[];
  inventario: string[];
};

export type BuiltinColumnKey =
  | "es_principal"
  | "nro_serie"
  | "estado"
  | "horas_acumuladas"
  | "created_at";

export type ColumnConfigItem =
  | {
      kind: "builtin";
      builtinKey: BuiltinColumnKey;
      visible: boolean;
    }
  | { kind: "attribute"; attributeId: number; visible: boolean };

type TipoInfo = {
  id: number;
  nombre: string;
  unidadMedicion: string | null;
  abrevUnidad: string | null;
};

type FormValues = {
  nroSerie: string;
  estado: string;
  horasAcumuladas: string;
  attrs: Record<string, string>; // key: `${nivelId}:${atributoId}`
};

const attrKey = (nivelId: number, atributoId: number) =>
  `${nivelId}:${atributoId}`;

function attrsForNivel(
  values: FormValues,
  nivelId: number,
  atributos: AtributoDef[],
) {
  return atributos.map((a) => ({
    atributoId: a.id,
    valueText: values.attrs[attrKey(nivelId, a.id)] ?? "",
  }));
}

function buildNivelPayload(values: FormValues, niveles: NivelDef[]) {
  return niveles.map((n) => ({
    nivelId: n.id,
    atributos: attrsForNivel(values, n.id, n.atributos),
  }));
}

function defaultsFromRow(
  row: MaquinaRow | null,
  niveles: NivelDef[],
): FormValues {
  const attrs: Record<string, string> = {};
  if (row) {
    const byNivel = new Map(row.niveles.map((n) => [n.nivelId, n.atributos]));
    for (const n of niveles) {
      const atrs = byNivel.get(n.id) ?? [];
      const byId = new Map(atrs.map((a) => [a.atributoId, a.valueText]));
      for (const a of n.atributos) {
        attrs[attrKey(n.id, a.id)] = byId.get(a.id) ?? "";
      }
    }
  } else {
    for (const n of niveles) {
      for (const a of n.atributos) attrs[attrKey(n.id, a.id)] = "";
    }
  }
  return {
    nroSerie: row?.nroSerie ?? "",
    estado: row?.estado ?? "activo",
    horasAcumuladas: row ? String(row.horasAcumuladas) : "0",
    attrs,
  };
}

function buildSchema(niveles: NivelDef[]) {
  return z
    .object({
      nroSerie: z.string().trim().max(120),
      estado: z.string().trim().min(1, "Obligatorio").max(40),
      horasAcumuladas: z.string().trim(),
      attrs: z.record(z.string(), z.string()),
    })
    .superRefine((v, ctx) => {
      const hs = Number(v.horasAcumuladas);
      if (!Number.isFinite(hs) || hs < 0) {
        ctx.addIssue({
          code: "custom",
          path: ["horasAcumuladas"],
          message: "Debe ser un número ≥ 0",
        });
      }
      for (const n of niveles) {
        for (const a of n.atributos) {
          const key = attrKey(n.id, a.id);
          const val = (v.attrs[key] ?? "").trim();
          if (a.activo && a.requerido && val === "") {
            ctx.addIssue({
              code: "custom",
              path: ["attrs", key],
              message: "Obligatorio",
            });
            continue;
          }
          if (val === "") continue;
          if (a.dataType === "number") {
            const n = Number(val);
            if (!Number.isFinite(n)) {
              ctx.addIssue({
                code: "custom",
                path: ["attrs", key],
                message: "Debe ser numérico",
              });
            }
          } else if (a.dataType === "date") {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
              ctx.addIssue({
                code: "custom",
                path: ["attrs", key],
                message: "Formato AAAA-MM-DD",
              });
            }
          }
        }
      }
    });
}

const DEFAULT_COLUMN_CONFIG: ColumnConfigItem[] = [
  { kind: "builtin", builtinKey: "es_principal", visible: true },
  { kind: "builtin", builtinKey: "estado", visible: true },
  { kind: "builtin", builtinKey: "horas_acumuladas", visible: true },
];

function normalizeColumnConfig(
  raw: ColumnConfigItem[],
  niveles: NivelDef[],
): ColumnConfigItem[] {
  const validAttrIds = new Set<number>();
  for (const n of niveles) for (const a of n.atributos) validAttrIds.add(a.id);
  const seenBuiltins = new Set<string>();
  const seenAttrs = new Set<number>();
  const out: ColumnConfigItem[] = [];
  for (const c of raw) {
    if (c.kind === "builtin") {
      if (seenBuiltins.has(c.builtinKey)) continue;
      seenBuiltins.add(c.builtinKey);
      out.push(c);
    } else {
      if (!validAttrIds.has(c.attributeId)) continue;
      if (seenAttrs.has(c.attributeId)) continue;
      seenAttrs.add(c.attributeId);
      out.push(c);
    }
  }
  return out;
}

export function MaquinariaClient({
  admin,
  tipo,
  tipos,
  niveles,
  rows,
  refs,
  columnConfig,
}: {
  admin: boolean;
  tipo: TipoInfo;
  tipos: TipoOption[];
  niveles: NivelDef[];
  rows: MaquinaRow[];
  refs: RefSources;
  columnConfig: ColumnConfigItem[];
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MaquinaRow | null>(null);
  const [estadoFilter, setEstadoFilter] = useState<string>("all");
  const [columnsOpen, setColumnsOpen] = useState(false);

  const effectiveConfig = useMemo(() => {
    const normalized = normalizeColumnConfig(columnConfig, niveles);
    return normalized.length > 0 ? normalized : DEFAULT_COLUMN_CONFIG;
  }, [columnConfig, niveles]);

  const schema = useMemo(() => buildSchema(niveles), [niveles]);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: defaultsFromRow(null, niveles),
  });

  const [isSubmitting, startSubmit] = useTransition();

  function openCreate() {
    setEditing(null);
    form.reset(defaultsFromRow(null, niveles));
    setOpen(true);
  }

  function openEdit(row: MaquinaRow) {
    setEditing(row);
    form.reset(defaultsFromRow(row, niveles));
    setOpen(true);
  }

  function submit() {
    form.handleSubmit((values) => {
      startSubmit(async () => {
        const payload = {
          tipoId: tipo.id,
          nroSerie: values.nroSerie.trim() || null,
          estado: values.estado,
          horasAcumuladas: Number(values.horasAcumuladas),
          niveles: buildNivelPayload(values, niveles),
        };
        const result = editing
          ? await updateMaquinaria(editing.id, payload)
          : await createMaquinaria(payload);
        if (result.ok) {
          toast.success(
            editing
              ? t("maquinaria.maquinas.actualizadaExitosa")
              : t("maquinaria.maquinas.creadaExitosa"),
          );
          setOpen(false);
        } else if (result.error === "forbidden") {
          toast.error(t("listados.common.errorForbidden"));
        } else if (result.error === "invalid") {
          if (result.fieldErrors) {
            for (const [path, msg] of Object.entries(result.fieldErrors)) {
              const parts = path.split(".");
              if (parts[0] === "niveles") {
                // translate niveles.0.atributos.0.valueText → attrs.<nivelId>:<atributoId>
                // Best-effort: show generic error since path maps via index.
                continue;
              }
              form.setError(parts[0] as keyof FormValues, { message: msg });
            }
          }
          toast.error(t("listados.common.errorGuardar"));
        } else if (result.error === "not_found") {
          toast.error(t("maquinaria.maquinas.noEncontrada"));
        } else {
          toast.error(t("listados.common.errorGuardar"));
        }
      });
    })();
  }

  async function onDelete(row: MaquinaRow) {
    const result = await deleteMaquinaria(row.id);
    if (result.ok) {
      toast.success(t("maquinaria.maquinas.eliminadaExitosa"));
    } else if (result.error === "in_use") {
      toast.error(
        t("maquinaria.maquinas.eliminarEnUso", {
          count: result.usageCount ?? 0,
        }),
      );
    } else if (result.error === "forbidden") {
      toast.error(t("listados.common.errorForbidden"));
    } else {
      toast.error(t("listados.common.errorGuardar"));
    }
  }

  const principalAtributos = useMemo(() => {
    const out: Array<{ nivelId: number; atributo: AtributoDef }> = [];
    for (const n of niveles)
      for (const a of n.atributos)
        if (a.esPrincipal && a.activo)
          out.push({ nivelId: n.id, atributo: a });
    return out;
  }, [niveles]);

  const atributosById = useMemo(() => {
    const map = new Map<number, { atributo: AtributoDef; nivel: NivelDef }>();
    for (const n of niveles) {
      for (const a of n.atributos) map.set(a.id, { atributo: a, nivel: n });
    }
    return map;
  }, [niveles]);

  const filteredRows = useMemo(() => {
    if (estadoFilter === "all") return rows;
    return rows.filter((r) => r.estado === estadoFilter);
  }, [rows, estadoFilter]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    [],
  );

  const columns: ColumnDef<MaquinaRow>[] = useMemo(() => {
    const cols: ColumnDef<MaquinaRow>[] = [];
    for (const item of effectiveConfig) {
      if (!item.visible) continue;
      if (item.kind === "builtin") {
        switch (item.builtinKey) {
          case "es_principal": {
            for (const { atributo } of principalAtributos) {
              cols.push({
                id: `attr_${atributo.id}`,
                header: atributo.nombre,
                enableSorting: true,
                accessorFn: (r) => r.values[atributo.id] ?? "",
                cell: ({ row }) => {
                  const v = row.original.values[atributo.id] ?? "";
                  return v ? (
                    <span className="font-medium">{v}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  );
                },
              });
            }
            break;
          }
          case "nro_serie":
            cols.push({
              accessorKey: "nroSerie",
              header: t("maquinaria.maquinas.nroSerie"),
              enableSorting: true,
              cell: ({ row }) =>
                row.original.nroSerie ? (
                  <span className="font-mono text-sm">
                    {row.original.nroSerie}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                ),
            });
            break;
          case "estado":
            cols.push({
              accessorKey: "estado",
              header: t("maquinaria.maquinas.estado"),
              enableSorting: true,
              cell: ({ row }) => {
                const v = row.original.estado;
                const variant =
                  v.toLowerCase() === "activo" ? "default" : "secondary";
                return <Badge variant={variant}>{v}</Badge>;
              },
            });
            break;
          case "horas_acumuladas":
            cols.push({
              accessorKey: "horasAcumuladas",
              header: tipo.abrevUnidad
                ? t("maquinaria.maquinas.horasUnidad", {
                    unidad: tipo.abrevUnidad,
                  })
                : t("maquinaria.maquinas.horas"),
              enableSorting: true,
              cell: ({ row }) => (
                <span className="tabular-nums">
                  {row.original.horasAcumuladas.toLocaleString("es-AR")}
                </span>
              ),
            });
            break;
          case "created_at":
            cols.push({
              id: "createdAt",
              header: t("maquinaria.columnas.builtin.created_at"),
              enableSorting: true,
              accessorFn: (r) => r.createdAt,
              cell: ({ row }) => {
                const d = new Date(row.original.createdAt);
                return (
                  <span className="tabular-nums text-sm text-muted-foreground">
                    {dateFormatter.format(d)}
                  </span>
                );
              },
            });
            break;
        }
      } else {
        const info = atributosById.get(item.attributeId);
        if (!info) continue;
        const { atributo } = info;
        cols.push({
          id: `attr_${atributo.id}`,
          header: atributo.nombre,
          enableSorting: true,
          accessorFn: (r) => r.values[atributo.id] ?? "",
          cell: ({ row }) => {
            const v = row.original.values[atributo.id] ?? "";
            return v ? (
              <span className="text-sm">{v}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          },
        });
      }
    }
    if (admin) {
      cols.push({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const m = row.original;
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <ActionsMenu>
                <DropdownMenuItem onClick={() => openEdit(m)}>
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
                  title={t("maquinaria.maquinas.eliminarPregunta")}
                  description={t("maquinaria.maquinas.eliminarAviso")}
                  confirmLabel={t("listados.common.eliminar")}
                  destructive
                  onConfirm={() => onDelete(m)}
                />
              </ActionsMenu>
            </div>
          );
        },
      });
    }
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    effectiveConfig,
    principalAtributos,
    atributosById,
    admin,
    tipo.abrevUnidad,
    dateFormatter,
  ]);

  const searchableKeys: (keyof MaquinaRow)[] = ["nroSerie"];

  const rootNiveles = niveles.filter((n) => n.parentLevelId == null);
  const childrenByParent = new Map<number, NivelDef[]>();
  for (const n of niveles) {
    if (n.parentLevelId != null) {
      const arr = childrenByParent.get(n.parentLevelId) ?? [];
      arr.push(n);
      childrenByParent.set(n.parentLevelId, arr);
    }
  }

  const title = editing
    ? t("maquinaria.maquinas.editarTitulo")
    : t("maquinaria.maquinas.nuevoTitulo");

  const sinEstructura = niveles.length === 0;

  return (
    <>
      <PageHeader
        title={t("maquinaria.maquinas.titulo", { nombre: tipo.nombre })}
        description={t("maquinaria.maquinas.descripcion", {
          count: rows.length,
        })}
        actions={
          <div className="flex items-center gap-2">
            {admin ? (
              <Button
                variant="outline"
                onClick={() => setColumnsOpen(true)}
                disabled={sinEstructura}
              >
                <Columns3 className="size-4" />
                {t("maquinaria.columnas.boton")}
              </Button>
            ) : null}
            {admin ? (
              <Button onClick={openCreate} disabled={sinEstructura}>
                <Plus className="size-4" />
                {t("maquinaria.maquinas.nueva")}
              </Button>
            ) : null}
          </div>
        }
      />

      {tipos.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("maquinaria.maquinas.otrosTipos")}
          </span>
          {tipos.map((tt) => (
            <Button
              key={tt.id}
              asChild
              variant={tt.id === tipo.id ? "default" : "outline"}
              size="sm"
              className={cn(tt.id === tipo.id && "pointer-events-none")}
            >
              <Link href={`/maquinaria/${tt.id}`}>{tt.nombre}</Link>
            </Button>
          ))}
        </div>
      ) : null}

      {sinEstructura ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("maquinaria.maquinas.sinEstructura")}
        </div>
      ) : (
        <DataTable<MaquinaRow>
          columns={columns}
          data={filteredRows}
          searchableKeys={searchableKeys}
          searchPlaceholder={t("maquinaria.maquinas.buscarPlaceholder")}
          onRowClick={admin ? openEdit : undefined}
          emptyState={
            admin
              ? t("maquinaria.maquinas.vacioAdmin")
              : t("maquinaria.maquinas.vacio")
          }
          filterSlot={
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("maquinaria.maquinas.estadoTodos")}
                </SelectItem>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="inactivo">Inactivo</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
              </SelectContent>
            </Select>
          }
        />
      )}

      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={title}
        isDirty={form.formState.isDirty}
        isSubmitting={isSubmitting}
        onSubmit={submit}
      >
        <Form {...form}>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="nroSerie"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("maquinaria.maquinas.nroSerie")}</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={120} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="estado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("maquinaria.maquinas.estado")} *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="inactivo">Inactivo</SelectItem>
                      <SelectItem value="baja">Baja</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="horasAcumuladas"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {tipo.unidadMedicion
                    ? t("maquinaria.maquinas.horometroConUnidad", {
                        unidad: tipo.unidadMedicion,
                      })
                    : t("maquinaria.maquinas.horometro")}
                </FormLabel>
                <FormControl>
                  <Input type="number" step="any" min="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {rootNiveles.map((nivel) => (
            <NivelSection
              key={nivel.id}
              nivel={nivel}
              childrenByParent={childrenByParent}
              form={form}
              refs={refs}
              depth={0}
              editing={editing != null}
            />
          ))}
        </Form>
      </FormSheet>

      {admin ? (
        <ColumnsDrawer
          open={columnsOpen}
          onOpenChange={setColumnsOpen}
          tipoId={tipo.id}
          niveles={niveles}
          current={effectiveConfig}
        />
      ) : null}
    </>
  );
}

function NivelSection({
  nivel,
  childrenByParent,
  form,
  refs,
  depth,
  editing,
}: {
  nivel: NivelDef;
  childrenByParent: Map<number, NivelDef[]>;
  form: UseFormReturn<FormValues>;
  refs: RefSources;
  depth: number;
  editing: boolean;
}) {
  const children = childrenByParent.get(nivel.id) ?? [];
  const isRoot = depth === 0;

  const visibleAtributos = nivel.atributos.filter((a) => {
    if (a.activo) return true;
    if (!editing) return false;
    const val = form.getValues(`attrs.${attrKey(nivel.id, a.id)}`);
    return !!val && val.trim() !== "";
  });

  return (
    <section
      className={cn(
        "flex flex-col gap-3",
        !isRoot && "rounded-md border border-border p-3",
      )}
    >
      <h3
        className={cn(
          "font-medium",
          isRoot ? "text-sm uppercase tracking-wide text-muted-foreground" : "text-sm",
        )}
      >
        {nivel.nombre}
      </h3>

      {visibleAtributos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin atributos.</p>
      ) : (
        <div className="grid gap-3">
          {visibleAtributos.map((a) => (
            <AtributoField
              key={a.id}
              nivelId={nivel.id}
              atributo={a}
              form={form}
              refs={refs}
            />
          ))}
        </div>
      )}

      {children.map((child) => (
        <NivelSection
          key={child.id}
          nivel={child}
          childrenByParent={childrenByParent}
          form={form}
          refs={refs}
          depth={depth + 1}
          editing={editing}
        />
      ))}
    </section>
  );
}

function AtributoField({
  nivelId,
  atributo,
  form,
  refs,
}: {
  nivelId: number;
  atributo: AtributoDef;
  form: UseFormReturn<FormValues>;
  refs: RefSources;
}) {
  const name = `attrs.${attrKey(nivelId, atributo.id)}` as const;
  const archived = !atributo.activo;
  const label = (
    <span
      className={cn(
        "flex flex-wrap items-center gap-2",
        archived && "text-muted-foreground",
      )}
    >
      <span className={archived ? "line-through" : undefined}>
        {atributo.nombre}
      </span>
      {atributo.requerido && !archived ? " *" : null}
      {archived ? (
        <Badge variant="secondary" className="font-normal">
          Archivado
        </Badge>
      ) : null}
    </span>
  );

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            {renderControl(atributo, field, refs, archived)}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function renderControl(
  atributo: AtributoDef,
  field: ControllerRenderProps<FormValues, `attrs.${string}`>,
  refs: RefSources,
  disabled: boolean,
) {
  switch (atributo.dataType) {
    case "number":
      return <Input type="number" step="any" {...field} disabled={disabled} />;
    case "date":
      return <Input type="date" {...field} disabled={disabled} />;
    case "list": {
      const opts = (atributo.listOptions ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return (
        <Select
          value={field.value}
          onValueChange={field.onChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleccionar…" />
          </SelectTrigger>
          <SelectContent>
            {opts.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case "ref": {
      const source = atributo.sourceRef ?? "";
      const list =
        source === "unidades_productivas"
          ? refs.unidades_productivas
          : source === "inventario"
            ? refs.inventario
            : [];
      const options: ComboboxOption[] = list.map((v) => ({
        value: v,
        label: v,
      }));
      return (
        <Combobox
          value={field.value}
          onChange={field.onChange}
          options={options}
          allowCreate
          disabled={disabled}
        />
      );
    }
    default:
      return <Input maxLength={1000} {...field} disabled={disabled} />;
  }
}

const BUILTIN_ORDER: BuiltinColumnKey[] = [
  "es_principal",
  "nro_serie",
  "estado",
  "horas_acumuladas",
  "created_at",
];

type DrawerEntry =
  | {
      key: string;
      kind: "builtin";
      builtinKey: BuiltinColumnKey;
      visible: boolean;
      locked: boolean;
    }
  | {
      key: string;
      kind: "attribute";
      attributeId: number;
      visible: boolean;
      locked: boolean;
    };

function buildDrawerEntries(
  current: ColumnConfigItem[],
  niveles: NivelDef[],
): DrawerEntry[] {
  const entries: DrawerEntry[] = [];
  const seenBuiltins = new Set<string>();
  const seenAttrs = new Set<number>();
  const allAttrIds = new Set<number>();
  for (const n of niveles) for (const a of n.atributos) allAttrIds.add(a.id);

  for (const c of current) {
    if (c.kind === "builtin") {
      if (seenBuiltins.has(c.builtinKey)) continue;
      seenBuiltins.add(c.builtinKey);
      entries.push({
        key: `b_${c.builtinKey}`,
        kind: "builtin",
        builtinKey: c.builtinKey,
        visible: c.builtinKey === "es_principal" ? true : c.visible,
        locked: c.builtinKey === "es_principal",
      });
    } else {
      if (!allAttrIds.has(c.attributeId)) continue;
      if (seenAttrs.has(c.attributeId)) continue;
      seenAttrs.add(c.attributeId);
      entries.push({
        key: `a_${c.attributeId}`,
        kind: "attribute",
        attributeId: c.attributeId,
        visible: c.visible,
        locked: false,
      });
    }
  }

  for (const key of BUILTIN_ORDER) {
    if (seenBuiltins.has(key)) continue;
    entries.push({
      key: `b_${key}`,
      kind: "builtin",
      builtinKey: key,
      visible: key === "es_principal",
      locked: key === "es_principal",
    });
  }

  for (const n of niveles) {
    for (const a of n.atributos) {
      if (seenAttrs.has(a.id)) continue;
      if (!a.activo) continue;
      entries.push({
        key: `a_${a.id}`,
        kind: "attribute",
        attributeId: a.id,
        visible: false,
        locked: false,
      });
    }
  }

  return entries;
}

function ColumnsDrawer({
  open,
  onOpenChange,
  tipoId,
  niveles,
  current,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  tipoId: number;
  niveles: NivelDef[];
  current: ColumnConfigItem[];
}) {
  const t = useTranslations();
  const [entries, setEntries] = useState<DrawerEntry[]>(() =>
    buildDrawerEntries(current, niveles),
  );
  const [isSaving, startSave] = useTransition();

  const atributoMeta = useMemo(() => {
    const map = new Map<number, { atributo: AtributoDef; nivel: NivelDef }>();
    for (const n of niveles) {
      for (const a of n.atributos) map.set(a.id, { atributo: a, nivel: n });
    }
    return map;
  }, [niveles]);

  function resetFromProps() {
    setEntries(buildDrawerEntries(current, niveles));
  }

  function handleOpenChange(next: boolean) {
    if (next) resetFromProps();
    onOpenChange(next);
  }

  function move(idx: number, delta: number) {
    const next = idx + delta;
    if (next < 0 || next >= entries.length) return;
    const copy = entries.slice();
    const [item] = copy.splice(idx, 1);
    copy.splice(next, 0, item);
    setEntries(copy);
  }

  function toggleVisible(idx: number) {
    const e = entries[idx];
    if (e.locked) return;
    const copy = entries.slice();
    copy[idx] = { ...e, visible: !e.visible };
    setEntries(copy);
  }

  function restoreDefault() {
    setEntries(buildDrawerEntries(DEFAULT_COLUMN_CONFIG, niveles));
  }

  function save() {
    const columns: ColumnConfigItem[] = entries.map((e) =>
      e.kind === "builtin"
        ? {
            kind: "builtin",
            builtinKey: e.builtinKey,
            visible: e.visible,
          }
        : {
            kind: "attribute",
            attributeId: e.attributeId,
            visible: e.visible,
          },
    );
    startSave(async () => {
      const result = await saveColumnConfig({ tipoId, columns });
      if (result.ok) {
        toast.success(t("maquinaria.columnas.guardadoExitoso"));
        onOpenChange(false);
      } else if (result.error === "forbidden") {
        toast.error(t("listados.common.errorForbidden"));
      } else {
        toast.error(t("maquinaria.columnas.errorGuardar"));
      }
    });
  }

  const visibleCount = entries.filter((e) => e.visible).length;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>{t("maquinaria.columnas.titulo")}</SheetTitle>
          <SheetDescription>
            {t("maquinaria.columnas.descripcion")}
          </SheetDescription>
          <p className="text-xs text-muted-foreground">
            {t("maquinaria.columnas.visibleTodas", {
              visible: visibleCount,
              total: entries.length,
            })}
          </p>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("maquinaria.columnas.sinAtributos")}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {entries.map((e, idx) => {
                const label =
                  e.kind === "builtin"
                    ? t(`maquinaria.columnas.builtin.${e.builtinKey}`)
                    : (atributoMeta.get(e.attributeId)?.atributo.nombre ?? "—");
                const sublabel =
                  e.kind === "attribute"
                    ? (atributoMeta.get(e.attributeId)?.nivel.nombre ?? null)
                    : null;
                return (
                  <li
                    key={e.key}
                    className={cn(
                      "flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5",
                      !e.visible && "opacity-60",
                    )}
                  >
                    <div className="flex flex-col">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={idx === 0}
                        onClick={() => move(idx, -1)}
                        aria-label={t("maquinaria.columnas.subir")}
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={idx === entries.length - 1}
                        onClick={() => move(idx, 1)}
                        aria-label={t("maquinaria.columnas.bajar")}
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                    </div>
                    <div className="flex flex-1 flex-col min-w-0">
                      <span className="truncate text-sm font-medium">
                        {label}
                      </span>
                      {sublabel ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {sublabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {e.locked ? (
                        <span className="text-xs text-muted-foreground">
                          {t("maquinaria.columnas.principalBloqueado")}
                        </span>
                      ) : null}
                      <Checkbox
                        checked={e.visible}
                        disabled={e.locked}
                        onCheckedChange={() => toggleVisible(idx)}
                        aria-label={label}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <SheetFooter className="border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={restoreDefault}
            disabled={isSaving}
          >
            {t("maquinaria.columnas.restaurarDefault")}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {t("maquinaria.columnas.cancelar")}
            </Button>
            <Button type="button" onClick={save} disabled={isSaving}>
              {isSaving
                ? t("maquinaria.columnas.guardando")
                : t("maquinaria.columnas.guardar")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
