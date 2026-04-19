"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, GitBranch } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

import { DataTable } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { ActionsMenu } from "@/components/app/actions-menu";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageHeader } from "@/components/app/page-header";

import {
  createMaquinariaTipo,
  updateMaquinariaTipo,
  deleteMaquinariaTipo,
} from "./actions";

export type TipoRow = {
  id: number;
  nombre: string;
  estado: string;
  unidadMedicion: string | null;
  abrevUnidad: string | null;
  createdAt: Date;
  instanciasCount: number;
  nivelesCount: number;
  atributosCount: number;
};

const formSchema = z.object({
  nombre: z.string().trim().min(1, "Obligatorio").max(120),
  estado: z.enum(["activo", "inactivo"]),
  unidadMedicion: z.string().trim().max(40),
  abrevUnidad: z.string().trim().max(10),
});
type FormValues = z.infer<typeof formSchema>;

const emptyForm: FormValues = {
  nombre: "",
  estado: "activo",
  unidadMedicion: "Horas",
  abrevUnidad: "hs",
};

export function TiposClient({ rows }: { rows: TipoRow[] }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TipoRow | null>(null);

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

  function openEdit(row: TipoRow) {
    setEditing(row);
    form.reset({
      nombre: row.nombre,
      estado: row.estado === "inactivo" ? "inactivo" : "activo",
      unidadMedicion: row.unidadMedicion ?? "",
      abrevUnidad: row.abrevUnidad ?? "",
    });
    setOpen(true);
  }

  function submit() {
    form.handleSubmit((values) => {
      startSubmit(async () => {
        const payload = {
          nombre: values.nombre,
          estado: values.estado,
          unidadMedicion: values.unidadMedicion || null,
          abrevUnidad: values.abrevUnidad || null,
        };
        const result = editing
          ? await updateMaquinariaTipo(editing.id, payload)
          : await createMaquinariaTipo(payload);
        if (result.ok) {
          toast.success(
            editing
              ? t("listados.common.actualizadoExitoso", {
                  entidad: t("maquinaria.tipos.singular"),
                  nombre: values.nombre,
                })
              : t("listados.common.creadoExitoso", {
                  entidad: t("maquinaria.tipos.singular"),
                  nombre: values.nombre,
                }),
          );
          setOpen(false);
        } else if (result.error === "forbidden") {
          toast.error(t("listados.common.errorForbidden"));
        } else if (result.error === "duplicate") {
          form.setError("nombre", {
            message: t("listados.common.duplicado"),
          });
        } else {
          toast.error(t("listados.common.errorGuardar"));
        }
      });
    })();
  }

  async function onDelete(row: TipoRow) {
    const result = await deleteMaquinariaTipo(row.id);
    if (result.ok) {
      toast.success(
        t("listados.common.eliminadoExitoso", {
          entidad: t("maquinaria.tipos.singular"),
          nombre: row.nombre,
        }),
      );
    } else if (result.error === "in_use") {
      toast.error(
        t("maquinaria.tipos.eliminarEnUso", {
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

  const columns: ColumnDef<TipoRow>[] = [
    {
      accessorKey: "nombre",
      header: t("maquinaria.tipos.nombre"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="font-medium">{row.original.nombre}</span>
      ),
    },
    {
      accessorKey: "estado",
      header: t("maquinaria.tipos.estado"),
      enableSorting: true,
      cell: ({ row }) =>
        row.original.estado === "inactivo" ? (
          <Badge variant="secondary">
            {t("listados.common.estadoInactivo")}
          </Badge>
        ) : (
          <Badge>{t("listados.common.estadoActivo")}</Badge>
        ),
    },
    {
      id: "unidad",
      header: t("maquinaria.tipos.unidad"),
      enableSorting: false,
      cell: ({ row }) => {
        const um = row.original.unidadMedicion;
        const ab = row.original.abrevUnidad;
        if (!um && !ab) return <span className="text-muted-foreground">—</span>;
        return (
          <span>
            {um ?? "—"}
            {ab ? (
              <span className="text-muted-foreground"> ({ab})</span>
            ) : null}
          </span>
        );
      },
    },
    {
      accessorKey: "instanciasCount",
      header: t("maquinaria.tipos.instancias"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.instanciasCount}</span>
      ),
    },
    {
      accessorKey: "atributosCount",
      header: t("maquinaria.tipos.atributos"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.atributosCount}
          <span className="mx-1">·</span>
          {t("maquinaria.tipos.nivelesCount", {
            count: row.original.nivelesCount,
          })}
        </span>
      ),
    },
    {
      id: "createdAt",
      header: t("maquinaria.tipos.creado"),
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
        const tipo = row.original;
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <ActionsMenu>
              <DropdownMenuItem asChild>
                <Link href={`/maquinaria/tipos/${tipo.id}/estructura`}>
                  <GitBranch className="size-4" />
                  {t("maquinaria.tipos.verEstructura")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => openEdit(tipo)}>
                {t("listados.common.editar")}
              </DropdownMenuItem>
              <ConfirmDialog
                trigger={
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    disabled={tipo.instanciasCount > 0}
                    className="text-destructive focus:text-destructive"
                  >
                    {t("listados.common.eliminar")}
                  </DropdownMenuItem>
                }
                title={t("maquinaria.tipos.eliminarPregunta", {
                  nombre: tipo.nombre,
                })}
                description={t("maquinaria.tipos.eliminarAviso")}
                confirmLabel={t("listados.common.eliminar")}
                destructive
                onConfirm={() => onDelete(tipo)}
              />
            </ActionsMenu>
          </div>
        );
      },
    },
  ];

  const title = editing
    ? t("maquinaria.tipos.editarTitulo")
    : t("maquinaria.tipos.nuevoTitulo");

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("maquinaria.tipos.titulo")}
        description={t("maquinaria.tipos.descripcion")}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {t("maquinaria.tipos.nuevo")}
          </Button>
        }
      />

      <DataTable<TipoRow>
        columns={columns}
        data={rows}
        searchableKeys={["nombre", "unidadMedicion", "abrevUnidad"]}
        initialSort={[{ id: "nombre", desc: false }]}
        onRowClick={openEdit}
        emptyState={t("listados.common.vacioAdmin", {
          entidad: t("maquinaria.tipos.plural"),
        })}
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
                <FormLabel>{t("maquinaria.tipos.nombre")} *</FormLabel>
                <FormControl>
                  <Input {...field} autoFocus maxLength={120} />
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
                <FormLabel>{t("maquinaria.tipos.estado")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="activo">
                      {t("listados.common.estadoActivo")}
                    </SelectItem>
                    <SelectItem value="inactivo">
                      {t("listados.common.estadoInactivo")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-[1fr_120px] gap-4">
            <FormField
              control={form.control}
              name="unidadMedicion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("maquinaria.tipos.unidadMedicion")}</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={40} placeholder="Horas" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="abrevUnidad"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("maquinaria.tipos.abrevUnidad")}</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={10} placeholder="hs" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("maquinaria.tipos.unidadAyuda")}
          </p>
        </Form>
      </FormSheet>
    </div>
  );
}
