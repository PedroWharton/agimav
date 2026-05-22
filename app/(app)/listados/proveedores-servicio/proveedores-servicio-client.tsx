"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Wrench, CheckCircle2, PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

import { Combobox } from "@/components/app/combobox";
import { DataTable } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { ActionsMenu } from "@/components/app/actions-menu";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageHeader } from "@/components/app/page-header";
import { Toolbar } from "@/components/app/toolbar";
import { KpiCard } from "@/components/stats/kpi-card";

import {
  createProveedorServicio,
  updateProveedorServicio,
  deactivateProveedorServicio,
  reactivateProveedorServicio,
} from "./actions";

export type ProveedorServicioRow = {
  id: number;
  nombre: string;
  rubro: string | null;
  cuit: string | null;
  email: string | null;
  telefono: string | null;
  contacto: string | null;
  observaciones: string | null;
  estado: string;
  serviciosCount: number;
  createdAt: Date;
};

export type ProveedoresServicioKpis = {
  total: number;
  activos: number;
  inactivos: number;
};

const CUIT_REGEX = /^\d{2}-\d{8}-\d$/;

const formSchema = z.object({
  nombre: z.string().trim().min(1, "Obligatorio").max(200),
  rubro: z.string().trim().max(120).optional(),
  cuit: z
    .string()
    .trim()
    .max(20)
    .optional()
    .refine((v) => !v || CUIT_REGEX.test(v), {
      message: "Formato: 30-12345678-9",
    }),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, {
      message: "Email inválido",
    }),
  telefono: z.string().trim().max(50).optional(),
  contacto: z.string().trim().max(200).optional(),
  observaciones: z.string().trim().max(500).optional(),
});
type FormValues = z.infer<typeof formSchema>;

type EstadoFilter = "activos" | "inactivos" | "todos";

const emptyForm: FormValues = {
  nombre: "",
  rubro: "",
  cuit: "",
  email: "",
  telefono: "",
  contacto: "",
  observaciones: "",
};

function rowToForm(row: ProveedorServicioRow): FormValues {
  return {
    nombre: row.nombre,
    rubro: row.rubro ?? "",
    cuit: row.cuit ?? "",
    email: row.email ?? "",
    telefono: row.telefono ?? "",
    contacto: row.contacto ?? "",
    observaciones: row.observaciones ?? "",
  };
}

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function ProveedoresServicioClient({
  rows,
  rubros,
  canManage,
  kpis,
}: {
  rows: ProveedorServicioRow[];
  rubros: string[];
  canManage: boolean;
  kpis: ProveedoresServicioKpis;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProveedorServicioRow | null>(null);
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("activos");
  const [search, setSearch] = useState("");

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: emptyForm,
  });

  const [isSubmitting, startSubmit] = useTransition();

  const rubroOptions = useMemo(
    () => rubros.map((r) => ({ value: r, label: r })),
    [rubros],
  );

  const filtered = useMemo(() => {
    let out = rows;
    if (estadoFilter !== "todos") {
      const want = estadoFilter === "activos" ? "activo" : "inactivo";
      out = out.filter((r) => r.estado === want);
    }
    const q = search.trim();
    if (q) {
      const qn = norm(q);
      out = out.filter(
        (r) =>
          norm(r.nombre).includes(qn) ||
          norm(r.rubro).includes(qn) ||
          norm(r.cuit).includes(qn) ||
          norm(r.contacto).includes(qn),
      );
    }
    return out;
  }, [rows, estadoFilter, search]);

  function openCreate() {
    setEditing(null);
    form.reset(emptyForm);
    setOpen(true);
  }

  function openEdit(row: ProveedorServicioRow) {
    setEditing(row);
    form.reset(rowToForm(row));
    setOpen(true);
  }

  const entidad = t("listados.proveedoresServicio.singular");

  function submit() {
    form.handleSubmit((values) => {
      startSubmit(async () => {
        const result = editing
          ? await updateProveedorServicio(editing.id, values)
          : await createProveedorServicio(values);
        if (result.ok) {
          toast.success(
            editing
              ? t("listados.common.actualizadoExitoso", {
                  entidad,
                  nombre: values.nombre,
                })
              : t("listados.common.creadoExitoso", {
                  entidad,
                  nombre: values.nombre,
                }),
          );
          setOpen(false);
        } else if (result.error === "invalid" && result.fieldErrors) {
          for (const [k, msg] of Object.entries(result.fieldErrors)) {
            form.setError(k as keyof FormValues, { message: msg });
          }
        } else if (result.error === "forbidden") {
          toast.error(t("listados.common.errorForbidden"));
        } else {
          toast.error(t("listados.common.errorGuardar"));
        }
      });
    })();
  }

  async function onDeactivate(row: ProveedorServicioRow) {
    const result = await deactivateProveedorServicio(row.id);
    if (result.ok) {
      toast.success(
        t("listados.common.desactivadoExitoso", { entidad, nombre: row.nombre }),
      );
    } else if (result.error === "forbidden") {
      toast.error(t("listados.common.errorForbidden"));
    } else {
      toast.error(t("listados.common.errorGuardar"));
    }
  }

  async function onReactivate(row: ProveedorServicioRow) {
    const result = await reactivateProveedorServicio(row.id);
    if (result.ok) {
      toast.success(
        t("listados.common.reactivadoExitoso", { entidad, nombre: row.nombre }),
      );
    } else if (result.error === "forbidden") {
      toast.error(t("listados.common.errorForbidden"));
    } else {
      toast.error(t("listados.common.errorGuardar"));
    }
  }

  const columns: ColumnDef<ProveedorServicioRow>[] = [
    {
      accessorKey: "nombre",
      header: t("listados.proveedoresServicio.nombre"),
      enableSorting: true,
    },
    {
      accessorKey: "rubro",
      header: t("listados.proveedoresServicio.rubro"),
      enableSorting: true,
      cell: ({ row }) =>
        row.original.rubro ?? <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: "telefono",
      header: t("listados.proveedoresServicio.telefono"),
      enableSorting: false,
      cell: ({ row }) =>
        row.original.telefono ?? (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "serviciosCount",
      header: t("listados.proveedoresServicio.serviciosCount"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.serviciosCount}
        </span>
      ),
    },
    {
      accessorKey: "estado",
      header: t("listados.proveedoresServicio.estado"),
      enableSorting: true,
      cell: ({ row }) => {
        const activo = row.original.estado === "activo";
        return (
          <Badge variant={activo ? "default" : "secondary"}>
            {activo
              ? t("listados.common.estadoActivo")
              : t("listados.common.estadoInactivo")}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        if (!canManage) return null;
        const p = row.original;
        const activo = p.estado === "activo";
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <ActionsMenu>
              <DropdownMenuItem onClick={() => openEdit(p)}>
                {t("listados.common.editar")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {activo ? (
                <ConfirmDialog
                  trigger={
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-destructive focus:text-destructive"
                    >
                      {t("listados.common.desactivar")}
                    </DropdownMenuItem>
                  }
                  title={t("listados.proveedoresServicio.desactivarPregunta", {
                    nombre: p.nombre,
                  })}
                  description={t("listados.proveedoresServicio.desactivarAviso")}
                  confirmLabel={t("listados.common.desactivar")}
                  destructive
                  onConfirm={() => onDeactivate(p)}
                />
              ) : (
                <DropdownMenuItem onClick={() => onReactivate(p)}>
                  {t("listados.common.reactivar")}
                </DropdownMenuItem>
              )}
            </ActionsMenu>
          </div>
        );
      },
    },
  ];

  const title = editing
    ? `${t("listados.common.editar")} ${entidad.toLowerCase()}`
    : `${t("listados.common.crear")} ${entidad.toLowerCase()}`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("listados.proveedoresServicio.titulo")}
        description={t("listados.proveedoresServicio.descripcion")}
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              {t("listados.common.crear")}
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <KpiCard
          icon={Wrench}
          tone="neutral"
          label={t("listados.proveedoresServicio.kpi.total")}
          value={kpis.total.toLocaleString("es-AR")}
          caption={t("listados.proveedoresServicio.kpi.totalCaption")}
        />
        <KpiCard
          icon={CheckCircle2}
          tone="ok"
          label={t("listados.proveedoresServicio.kpi.activos")}
          value={kpis.activos.toLocaleString("es-AR")}
          caption={t("listados.proveedoresServicio.kpi.activosCaption")}
        />
        <KpiCard
          icon={PauseCircle}
          tone={kpis.inactivos > 0 ? "warn" : "neutral"}
          label={t("listados.proveedoresServicio.kpi.inactivos")}
          value={kpis.inactivos.toLocaleString("es-AR")}
          caption={t("listados.proveedoresServicio.kpi.inactivosCaption")}
        />
      </div>

      <Toolbar>
        <Toolbar.Search
          value={search}
          onValueChange={setSearch}
          placeholder={t("listados.proveedoresServicio.buscarPlaceholder")}
        />
        <Toolbar.Selects>
          <Select
            value={estadoFilter}
            onValueChange={(v) => setEstadoFilter(v as EstadoFilter)}
          >
            <SelectTrigger className="h-9 min-w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="activos">
                {t("listados.common.filtroActivos")}
              </SelectItem>
              <SelectItem value="inactivos">
                {t("listados.common.filtroInactivos")}
              </SelectItem>
              <SelectItem value="todos">
                {t("listados.common.filtroTodos")}
              </SelectItem>
            </SelectContent>
          </Select>
        </Toolbar.Selects>
      </Toolbar>

      <DataTable<ProveedorServicioRow>
        columns={columns}
        data={filtered}
        initialSort={[{ id: "nombre", desc: false }]}
        onRowClick={canManage ? openEdit : undefined}
        emptyState={
          search.trim() || estadoFilter !== "todos"
            ? t("listados.common.sinResultadosFiltrados")
            : canManage
              ? t("listados.common.vacioAdmin", {
                  entidad: t("listados.proveedoresServicio.plural"),
                })
              : t("listados.common.vacio", {
                  entidad: t("listados.proveedoresServicio.plural"),
                })
        }
      />

      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={title}
        isDirty={form.formState.isDirty}
        isSubmitting={isSubmitting}
        onSubmit={submit}
      >
        <Form {...form}>
          <FormField
            control={form.control}
            name="nombre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("listados.proveedoresServicio.nombre")} *
                </FormLabel>
                <FormControl>
                  <Input {...field} autoFocus />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="rubro"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("listados.proveedoresServicio.rubro")}</FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    options={rubroOptions}
                    placeholder={t(
                      "listados.proveedoresServicio.rubroPlaceholder",
                    )}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="cuit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("listados.proveedoresServicio.cuit")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="30-12345678-9"
                      className="tabular-nums"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="telefono"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("listados.proveedoresServicio.telefono")}
                  </FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("listados.proveedoresServicio.email")}
                  </FormLabel>
                  <FormControl>
                    <Input {...field} type="email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contacto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("listados.proveedoresServicio.contacto")}
                  </FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="observaciones"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("listados.proveedoresServicio.observaciones")}
                </FormLabel>
                <FormControl>
                  <Textarea {...field} rows={3} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Form>
      </FormSheet>
    </div>
  );
}
