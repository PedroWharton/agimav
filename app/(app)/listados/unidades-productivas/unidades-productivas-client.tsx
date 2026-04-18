"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus } from "lucide-react";
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

import {
  createUnidadProductiva,
  updateUnidadProductiva,
  deleteUnidadProductiva,
} from "./actions";

export type UnidadProductivaRow = {
  id: number;
  nombre: string;
  localidadId: number | null;
  localidadNombre: string | null;
  tipoUnidadId: number | null;
  tipoUnidadNombre: string | null;
  createdAt: Date;
  usageCount: number;
};

export type LocalidadOption = { id: number; nombre: string };
export type TipoUnidadOption = { id: number; nombre: string };

const NONE = "__none__";

const formSchema = z.object({
  nombre: z.string().trim().min(1, "Obligatorio").max(200),
  localidadId: z.string(),
  tipoUnidadId: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

const emptyForm: FormValues = {
  nombre: "",
  localidadId: NONE,
  tipoUnidadId: NONE,
};

export function UnidadesProductivasClient({
  rows,
  localidades,
  tipos,
  isAdmin,
}: {
  rows: UnidadProductivaRow[];
  localidades: LocalidadOption[];
  tipos: TipoUnidadOption[];
  isAdmin: boolean;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UnidadProductivaRow | null>(null);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: emptyForm,
  });

  const [isSubmitting, startSubmit] = useTransition();

  function openCreate() {
    setEditing(null);
    form.reset(emptyForm);
    setOpen(true);
  }

  function openEdit(row: UnidadProductivaRow) {
    setEditing(row);
    form.reset({
      nombre: row.nombre,
      localidadId: row.localidadId == null ? NONE : String(row.localidadId),
      tipoUnidadId: row.tipoUnidadId == null ? NONE : String(row.tipoUnidadId),
    });
    setOpen(true);
  }

  function submit() {
    form.handleSubmit((values) => {
      startSubmit(async () => {
        const payload = {
          nombre: values.nombre,
          localidadId:
            values.localidadId === NONE ? null : Number(values.localidadId),
          tipoUnidadId:
            values.tipoUnidadId === NONE ? null : Number(values.tipoUnidadId),
        };
        const result = editing
          ? await updateUnidadProductiva(editing.id, payload)
          : await createUnidadProductiva(payload);
        if (result.ok) {
          toast.success(
            editing
              ? t("listados.common.actualizadoExitoso", {
                  entidad: t("listados.unidadesProductivas.singular"),
                  nombre: values.nombre,
                })
              : t("listados.common.creadoExitoso", {
                  entidad: t("listados.unidadesProductivas.singular"),
                  nombre: values.nombre,
                }),
          );
          setOpen(false);
        } else if (result.error === "forbidden") {
          toast.error(t("listados.common.errorForbidden"));
        } else {
          toast.error(t("listados.common.errorGuardar"));
        }
      });
    })();
  }

  async function onDelete(row: UnidadProductivaRow) {
    const result = await deleteUnidadProductiva(row.id);
    if (result.ok) {
      toast.success(
        t("listados.common.eliminadoExitoso", {
          entidad: t("listados.unidadesProductivas.singular"),
          nombre: row.nombre,
        }),
      );
    } else if (result.error === "in_use") {
      toast.error(
        t("listados.unidadesProductivas.eliminarEnUso", {
          nombre: row.nombre,
          count: result.usageCount ?? 0,
        }),
      );
    } else if (result.error === "forbidden") {
      toast.error(t("listados.common.errorForbidden"));
    } else {
      toast.error(t("listados.common.errorGuardar"));
    }
  }

  const columns: ColumnDef<UnidadProductivaRow>[] = [
    {
      accessorKey: "nombre",
      header: t("listados.unidadesProductivas.nombre"),
      enableSorting: true,
    },
    {
      accessorKey: "localidadNombre",
      header: t("listados.unidadesProductivas.localidad"),
      enableSorting: true,
      cell: ({ row }) =>
        row.original.localidadNombre ?? (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "tipoUnidadNombre",
      header: t("listados.unidadesProductivas.tipo"),
      enableSorting: true,
      cell: ({ row }) =>
        row.original.tipoUnidadNombre ?? (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "usageCount",
      header: "Referencias",
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.usageCount}
        </span>
      ),
    },
    {
      id: "createdAt",
      header: "Creado",
      accessorFn: (r) => r.createdAt.getTime(),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {format(row.original.createdAt, "yyyy-MM-dd", { locale: es })}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        if (!isAdmin) return null;
        const u = row.original;
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <ActionsMenu>
              <DropdownMenuItem onClick={() => openEdit(u)}>
                {t("listados.common.editar")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <ConfirmDialog
                trigger={
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-destructive focus:text-destructive"
                  >
                    {t("listados.common.eliminar")}
                  </DropdownMenuItem>
                }
                title={t("listados.unidadesProductivas.eliminarPregunta", {
                  nombre: u.nombre,
                })}
                description={t("listados.roles.eliminarAviso")}
                confirmLabel={t("listados.common.eliminar")}
                destructive
                onConfirm={() => onDelete(u)}
              />
            </ActionsMenu>
          </div>
        );
      },
    },
  ];

  const title = editing
    ? `${t("listados.common.editar")} ${t("listados.unidadesProductivas.singular").toLowerCase()}`
    : `${t("listados.common.crear")} ${t("listados.unidadesProductivas.singular").toLowerCase()}`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("listados.unidadesProductivas.titulo")}
        description={t("listados.unidadesProductivas.descripcion")}
        actions={
          isAdmin ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              {t("listados.common.crear")}
            </Button>
          ) : null
        }
      />

      <DataTable<UnidadProductivaRow>
        columns={columns}
        data={rows}
        searchableKeys={["nombre", "localidadNombre", "tipoUnidadNombre"]}
        initialSort={[{ id: "nombre", desc: false }]}
        onRowClick={isAdmin ? openEdit : undefined}
        emptyState={
          isAdmin
            ? t("listados.common.vacioAdmin", {
                entidad: t("listados.unidadesProductivas.plural"),
              })
            : t("listados.common.vacio", {
                entidad: t("listados.unidadesProductivas.plural"),
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
                  {t("listados.unidadesProductivas.nombre")} *
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
            name="localidadId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("listados.unidadesProductivas.localidad")}
                </FormLabel>
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
          <FormField
            control={form.control}
            name="tipoUnidadId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("listados.unidadesProductivas.tipo")}
                </FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {tipos.map((tu) => (
                      <SelectItem key={tu.id} value={String(tu.id)}>
                        {tu.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </Form>
      </FormSheet>
    </div>
  );
}
