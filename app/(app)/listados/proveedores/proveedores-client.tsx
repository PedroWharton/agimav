"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

import { DataTable } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { ActionsMenu } from "@/components/app/actions-menu";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageHeader } from "@/components/app/page-header";

import {
  createProveedor,
  updateProveedor,
  deactivateProveedor,
  reactivateProveedor,
} from "./actions";
import { CONDICIONES_IVA } from "./types";

export type ProveedorRow = {
  id: number;
  nombre: string;
  cuit: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  direccionFiscal: string | null;
  condicionIva: string | null;
  nombreContacto: string | null;
  contacto: string | null;
  estado: string;
  localidadId: number | null;
  localidadNombre: string | null;
  createdAt: Date;
};

export type LocalidadOption = { id: number; nombre: string };

const NONE = "__none__";
const CUIT_REGEX = /^\d{2}-\d{8}-\d$/;

const formSchema = z.object({
  nombre: z.string().trim().min(1, "Obligatorio").max(200),
  cuit: z
    .string()
    .trim()
    .max(20)
    .optional()
    .refine((v) => !v || CUIT_REGEX.test(v), {
      message: "Formato: 30-12345678-9",
    }),
  condicionIva: z.string(),
  localidadId: z.string(),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, {
      message: "Email inválido",
    }),
  telefono: z.string().trim().max(50).optional(),
  direccion: z.string().trim().max(300).optional(),
  direccionFiscal: z.string().trim().max(300).optional(),
  nombreContacto: z.string().trim().max(200).optional(),
  contacto: z.string().trim().max(200).optional(),
});
type FormValues = z.infer<typeof formSchema>;

type EstadoFilter = "activos" | "inactivos" | "todos";

const emptyForm: FormValues = {
  nombre: "",
  cuit: "",
  condicionIva: NONE,
  localidadId: NONE,
  email: "",
  telefono: "",
  direccion: "",
  direccionFiscal: "",
  nombreContacto: "",
  contacto: "",
};

function rowToForm(row: ProveedorRow): FormValues {
  return {
    nombre: row.nombre,
    cuit: row.cuit ?? "",
    condicionIva: row.condicionIva ?? NONE,
    localidadId: row.localidadId == null ? NONE : String(row.localidadId),
    email: row.email ?? "",
    telefono: row.telefono ?? "",
    direccion: row.direccion ?? "",
    direccionFiscal: row.direccionFiscal ?? "",
    nombreContacto: row.nombreContacto ?? "",
    contacto: row.contacto ?? "",
  };
}

export function ProveedoresClient({
  rows,
  localidades,
  isAdmin,
}: {
  rows: ProveedorRow[];
  localidades: LocalidadOption[];
  isAdmin: boolean;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProveedorRow | null>(null);
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("activos");

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: emptyForm,
  });

  const [isSubmitting, startSubmit] = useTransition();

  const filtered = useMemo(() => {
    if (estadoFilter === "todos") return rows;
    const want = estadoFilter === "activos" ? "activo" : "inactivo";
    return rows.filter((r) => r.estado === want);
  }, [rows, estadoFilter]);

  function openCreate() {
    setEditing(null);
    form.reset(emptyForm);
    setOpen(true);
  }

  function openEdit(row: ProveedorRow) {
    setEditing(row);
    form.reset(rowToForm(row));
    setOpen(true);
  }

  function submit() {
    form.handleSubmit((values) => {
      startSubmit(async () => {
        const payload = {
          nombre: values.nombre,
          cuit: values.cuit ?? "",
          condicionIva: values.condicionIva === NONE ? "" : values.condicionIva,
          localidadId:
            values.localidadId === NONE ? null : Number(values.localidadId),
          email: values.email ?? "",
          telefono: values.telefono ?? "",
          direccion: values.direccion ?? "",
          direccionFiscal: values.direccionFiscal ?? "",
          nombreContacto: values.nombreContacto ?? "",
          contacto: values.contacto ?? "",
        };
        const result = editing
          ? await updateProveedor(editing.id, payload)
          : await createProveedor(payload);
        if (result.ok) {
          toast.success(
            editing
              ? t("listados.common.actualizadoExitoso", {
                  entidad: t("listados.proveedores.singular"),
                  nombre: values.nombre,
                })
              : t("listados.common.creadoExitoso", {
                  entidad: t("listados.proveedores.singular"),
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

  async function onDeactivate(row: ProveedorRow) {
    const result = await deactivateProveedor(row.id);
    if (result.ok) {
      toast.success(
        t("listados.common.desactivadoExitoso", {
          entidad: t("listados.proveedores.singular"),
          nombre: row.nombre,
        }),
      );
    } else if (result.error === "forbidden") {
      toast.error(t("listados.common.errorForbidden"));
    } else {
      toast.error(t("listados.common.errorGuardar"));
    }
  }

  async function onReactivate(row: ProveedorRow) {
    const result = await reactivateProveedor(row.id);
    if (result.ok) {
      toast.success(
        t("listados.common.reactivadoExitoso", {
          entidad: t("listados.proveedores.singular"),
          nombre: row.nombre,
        }),
      );
    } else if (result.error === "forbidden") {
      toast.error(t("listados.common.errorForbidden"));
    } else {
      toast.error(t("listados.common.errorGuardar"));
    }
  }

  const columns: ColumnDef<ProveedorRow>[] = [
    {
      accessorKey: "nombre",
      header: t("listados.proveedores.nombre"),
      enableSorting: true,
    },
    {
      accessorKey: "cuit",
      header: t("listados.proveedores.cuit"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.cuit ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "localidadNombre",
      header: t("listados.proveedores.localidad"),
      enableSorting: true,
      cell: ({ row }) =>
        row.original.localidadNombre ?? (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "estado",
      header: t("listados.proveedores.estado"),
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
        if (!isAdmin) return null;
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
                  title={`¿Desactivar a "${p.nombre}"?`}
                  description="El proveedor se ocultará de los selectores de compras pero sus registros históricos se conservan. Podés reactivarlo más tarde."
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
    ? `${t("listados.common.editar")} ${t("listados.proveedores.singular").toLowerCase()}`
    : `${t("listados.common.crear")} ${t("listados.proveedores.singular").toLowerCase()}`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("listados.proveedores.titulo")}
        description={t("listados.proveedores.descripcion")}
        actions={
          isAdmin ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              {t("listados.common.crear")}
            </Button>
          ) : null
        }
      />

      <DataTable<ProveedorRow>
        columns={columns}
        data={filtered}
        searchableKeys={["nombre", "cuit", "email", "localidadNombre"]}
        initialSort={[{ id: "nombre", desc: false }]}
        onRowClick={isAdmin ? openEdit : undefined}
        filterSlot={
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
        }
        emptyState={
          isAdmin
            ? t("listados.common.vacioAdmin", {
                entidad: t("listados.proveedores.plural"),
              })
            : t("listados.common.vacio", {
                entidad: t("listados.proveedores.plural"),
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
                <FormLabel>{t("listados.proveedores.nombre")} *</FormLabel>
                <FormControl>
                  <Input {...field} autoFocus />
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
                  <FormLabel>{t("listados.proveedores.cuit")}</FormLabel>
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
              name="condicionIva"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("listados.proveedores.condicionIva")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {CONDICIONES_IVA.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="localidadId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("listados.proveedores.localidad")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {localidades.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("listados.proveedores.email")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" />
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
                  <FormLabel>{t("listados.proveedores.telefono")}</FormLabel>
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
            name="direccion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("listados.proveedores.direccion")}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="direccionFiscal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("listados.proveedores.direccionFiscal")}
                </FormLabel>
                <FormControl>
                  <Input {...field} placeholder="(si es diferente)" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="nombreContacto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("listados.proveedores.contacto")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>Notas de contacto</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Form>
      </FormSheet>
    </div>
  );
}
