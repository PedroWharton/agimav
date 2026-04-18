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
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { DataTable } from "@/components/app/data-table";
import { FormDialog } from "@/components/app/form-dialog";
import { ActionsMenu } from "@/components/app/actions-menu";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageHeader } from "@/components/app/page-header";

import { createUnidadMedida, updateUnidadMedida, deleteUnidadMedida } from "./actions";

export type UnidadMedidaRow = {
  id: number;
  nombre: string;
  abreviacion: string;
  createdAt: Date;
};

const formSchema = z.object({
  nombre: z.string().trim().min(1, "Obligatorio").max(100),
  abreviacion: z.string().trim().min(1, "Obligatorio").max(20),
});
type FormValues = z.infer<typeof formSchema>;

export function UnidadesMedidaClient({
  rows,
  isAdmin,
}: {
  rows: UnidadMedidaRow[];
  isAdmin: boolean;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UnidadMedidaRow | null>(null);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: { nombre: "", abreviacion: "" },
  });

  const [isSubmitting, startSubmit] = useTransition();

  function openCreate() {
    setEditing(null);
    form.reset({ nombre: "", abreviacion: "" });
    setOpen(true);
  }

  function openEdit(row: UnidadMedidaRow) {
    setEditing(row);
    form.reset({ nombre: row.nombre, abreviacion: row.abreviacion });
    setOpen(true);
  }

  function submit() {
    form.handleSubmit((values) => {
      startSubmit(async () => {
        const result = editing
          ? await updateUnidadMedida(editing.id, values)
          : await createUnidadMedida(values);
        if (result.ok) {
          toast.success(
            editing
              ? t("listados.common.actualizadoExitoso", {
                  entidad: t("listados.unidadesMedida.singular"),
                  nombre: values.nombre,
                })
              : t("listados.common.creadoExitoso", {
                  entidad: t("listados.unidadesMedida.singular"),
                  nombre: values.nombre,
                }),
          );
          setOpen(false);
        } else if (result.error === "duplicate") {
          form.setError("nombre", { message: t("listados.common.duplicado") });
        } else if (result.error === "forbidden") {
          toast.error(t("listados.common.errorForbidden"));
        } else {
          toast.error(t("listados.common.errorGuardar"));
        }
      });
    })();
  }

  async function onDelete(row: UnidadMedidaRow) {
    const result = await deleteUnidadMedida(row.id);
    if (result.ok) {
      toast.success(
        t("listados.common.eliminadoExitoso", {
          entidad: t("listados.unidadesMedida.singular"),
          nombre: row.nombre,
        }),
      );
    } else if (result.error === "in_use") {
      toast.error(
        t("listados.unidadesMedida.eliminarEnUso", {
          nombre: row.nombre,
          count: result.inventarioCount ?? 0,
        }),
      );
    } else if (result.error === "forbidden") {
      toast.error(t("listados.common.errorForbidden"));
    } else {
      toast.error(t("listados.common.errorGuardar"));
    }
  }

  const columns: ColumnDef<UnidadMedidaRow>[] = [
    { accessorKey: "nombre", header: t("listados.unidadesMedida.nombre"), enableSorting: true },
    {
      accessorKey: "abreviacion",
      header: t("listados.unidadesMedida.abreviacion"),
      enableSorting: true,
    },
    {
      id: "createdAt",
      header: "Creado",
      accessorFn: (row) => row.createdAt.getTime(),
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
        const r = row.original;
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <ActionsMenu>
              <DropdownMenuItem onClick={() => openEdit(r)}>
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
                title={t("listados.unidadesMedida.eliminarPregunta", { nombre: r.nombre })}
                description={t("listados.roles.eliminarAviso")}
                confirmLabel={t("listados.common.eliminar")}
                destructive
                onConfirm={() => onDelete(r)}
              />
            </ActionsMenu>
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("listados.unidadesMedida.titulo")}
        description={t("listados.unidadesMedida.descripcion")}
        actions={
          isAdmin ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              {t("listados.common.crear")}
            </Button>
          ) : null
        }
      />

      <DataTable<UnidadMedidaRow>
        columns={columns}
        data={rows}
        searchableKeys={["nombre", "abreviacion"]}
        initialSort={[{ id: "nombre", desc: false }]}
        onRowClick={isAdmin ? openEdit : undefined}
        emptyState={
          isAdmin
            ? t("listados.common.vacioAdmin", { entidad: t("listados.unidadesMedida.plural") })
            : t("listados.common.vacio", { entidad: t("listados.unidadesMedida.plural") })
        }
      />

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={
          editing
            ? `${t("listados.common.editar")} ${t("listados.unidadesMedida.singular").toLowerCase()}`
            : `${t("listados.common.crear")} ${t("listados.unidadesMedida.singular").toLowerCase()}`
        }
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
                <FormLabel>{t("listados.unidadesMedida.nombre")} *</FormLabel>
                <FormControl>
                  <Input {...field} autoFocus />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="abreviacion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("listados.unidadesMedida.abreviacion")} *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Form>
      </FormDialog>
    </div>
  );
}
