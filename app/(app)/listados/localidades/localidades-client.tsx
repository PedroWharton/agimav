"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, MapPin, Link2, Circle } from "lucide-react";
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
import { FormSheet } from "@/components/app/form-sheet";
import { ActionsMenu } from "@/components/app/actions-menu";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageHeader } from "@/components/app/page-header";
import { Toolbar } from "@/components/app/toolbar";
import { KpiCard } from "@/components/stats/kpi-card";

import { createLocalidad, updateLocalidad, deleteLocalidad } from "./actions";

export type LocalidadRow = {
  id: number;
  nombre: string;
  usageCount: number;
  createdAt: Date;
};

export type LocalidadesKpis = {
  total: number;
  enUso: number;
  sinUso: number;
};

const formSchema = z.object({
  nombre: z.string().trim().min(1, "Obligatorio").max(100),
});
type FormValues = z.infer<typeof formSchema>;

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function LocalidadesClient({
  rows,
  canManage,
  kpis,
}: {
  rows: LocalidadRow[];
  canManage: boolean;
  kpis: LocalidadesKpis;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LocalidadRow | null>(null);
  const [search, setSearch] = useState("");

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: { nombre: "" },
  });

  const [isSubmitting, startSubmit] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return rows;
    const qn = norm(q);
    return rows.filter((r) => norm(r.nombre).includes(qn));
  }, [rows, search]);

  function openCreate() {
    setEditing(null);
    form.reset({ nombre: "" });
    setOpen(true);
  }

  function openEdit(row: LocalidadRow) {
    setEditing(row);
    form.reset({ nombre: row.nombre });
    setOpen(true);
  }

  function submit() {
    form.handleSubmit((values) => {
      startSubmit(async () => {
        const result = editing
          ? await updateLocalidad(editing.id, values)
          : await createLocalidad(values);
        if (result.ok) {
          toast.success(
            editing
              ? t("listados.common.actualizadoExitoso", {
                  entidad: t("listados.localidades.singular"),
                  nombre: values.nombre,
                })
              : t("listados.common.creadoExitoso", {
                  entidad: t("listados.localidades.singular"),
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

  async function onDelete(row: LocalidadRow) {
    const result = await deleteLocalidad(row.id);
    if (result.ok) {
      toast.success(
        t("listados.common.eliminadoExitoso", {
          entidad: t("listados.localidades.singular"),
          nombre: row.nombre,
        }),
      );
    } else if (result.error === "in_use") {
      toast.error(
        t("listados.localidades.eliminarEnUso", {
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

  const columns: ColumnDef<LocalidadRow>[] = [
    {
      accessorKey: "nombre",
      header: t("listados.localidades.nombre"),
      enableSorting: true,
    },
    {
      accessorKey: "usageCount",
      header: t("listados.localidades.referencias"),
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
        if (!canManage) return null;
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
                title={t("listados.localidades.eliminarPregunta", {
                  nombre: r.nombre,
                })}
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

  const title = editing
    ? `${t("listados.common.editar")} ${t("listados.localidades.singular").toLowerCase()}`
    : `${t("listados.common.crear")} ${t("listados.localidades.singular").toLowerCase()}`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("listados.localidades.titulo")}
        description={t("listados.localidades.descripcion")}
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              {t("listados.common.crear")}
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard
          icon={MapPin}
          tone="neutral"
          label={t("listados.localidades.kpi.total")}
          value={kpis.total.toLocaleString("es-AR")}
          caption={t("listados.localidades.kpi.totalCaption")}
        />
        <KpiCard
          icon={Link2}
          tone="ok"
          label={t("listados.localidades.kpi.enUso")}
          value={kpis.enUso.toLocaleString("es-AR")}
          caption={t("listados.localidades.kpi.enUsoCaption")}
        />
        <KpiCard
          icon={Circle}
          tone="neutral"
          label={t("listados.localidades.kpi.sinUso")}
          value={kpis.sinUso.toLocaleString("es-AR")}
          caption={t("listados.localidades.kpi.sinUsoCaption")}
        />
      </div>

      <Toolbar>
        <Toolbar.Search
          value={search}
          onValueChange={setSearch}
          placeholder={t("listados.localidades.buscarPlaceholder")}
        />
      </Toolbar>

      <DataTable<LocalidadRow>
        columns={columns}
        data={filtered}
        initialSort={[{ id: "nombre", desc: false }]}
        onRowClick={canManage ? openEdit : undefined}
        emptyState={
          search.trim()
            ? t("listados.common.sinResultadosFiltrados")
            : canManage
              ? t("listados.common.vacioAdmin", {
                  entidad: t("listados.localidades.plural"),
                })
              : t("listados.common.vacio", {
                  entidad: t("listados.localidades.plural"),
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
                <FormLabel>{t("listados.localidades.nombre")} *</FormLabel>
                <FormControl>
                  <Input {...field} autoFocus />
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
