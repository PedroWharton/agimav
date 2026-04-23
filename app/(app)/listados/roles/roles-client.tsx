"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, ShieldCheck, UserCheck, UserMinus } from "lucide-react";
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

import { createRol, updateRol, deleteRol } from "./actions";

export type RolRow = {
  id: number;
  nombre: string;
  usuariosCount: number;
  permisosCount: number;
  createdAt: Date;
};

export type RolesKpis = {
  total: number;
  asignados: number;
  sinUsuarios: number;
};

const rolFormSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100),
});
type RolFormValues = z.infer<typeof rolFormSchema>;

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function RolesClient({
  roles,
  isAdmin,
  kpis,
}: {
  roles: RolRow[];
  isAdmin: boolean;
  kpis: RolesKpis;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RolRow | null>(null);
  const [search, setSearch] = useState("");

  const form = useForm<RolFormValues>({
    resolver: standardSchemaResolver(rolFormSchema),
    defaultValues: { nombre: "" },
  });

  const [isSubmitting, startSubmit] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return roles;
    const qn = norm(q);
    return roles.filter((r) => norm(r.nombre).includes(qn));
  }, [roles, search]);

  function openCreate() {
    setEditing(null);
    form.reset({ nombre: "" });
    setOpen(true);
  }

  function openEdit(row: RolRow) {
    setEditing(row);
    form.reset({ nombre: row.nombre });
    setOpen(true);
  }

  function submit() {
    form.handleSubmit((values) => {
      startSubmit(async () => {
        const result = editing
          ? await updateRol(editing.id, values)
          : await createRol(values);
        if (result.ok) {
          toast.success(
            editing
              ? t("listados.common.actualizadoExitoso", {
                  entidad: t("listados.roles.singular"),
                  nombre: values.nombre,
                })
              : t("listados.common.creadoExitoso", {
                  entidad: t("listados.roles.singular"),
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

  async function onDelete(row: RolRow) {
    const result = await deleteRol(row.id);
    if (result.ok) {
      toast.success(
        t("listados.common.eliminadoExitoso", {
          entidad: t("listados.roles.singular"),
          nombre: row.nombre,
        }),
      );
    } else if (result.error === "in_use") {
      toast.error(
        t("listados.roles.eliminarEnUso", {
          nombre: row.nombre,
          count: result.usuariosCount ?? 0,
        }),
      );
    } else if (result.error === "forbidden") {
      toast.error(t("listados.common.errorForbidden"));
    } else {
      toast.error(t("listados.common.errorGuardar"));
    }
  }

  const columns: ColumnDef<RolRow>[] = [
    {
      accessorKey: "nombre",
      header: t("listados.roles.nombre"),
      enableSorting: true,
    },
    {
      accessorKey: "usuariosCount",
      header: t("listados.roles.usuariosCount"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.usuariosCount}
        </span>
      ),
    },
    {
      accessorKey: "permisosCount",
      header: t("listados.roles.permisosCount"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.permisosCount}
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
        if (!isAdmin) return null;
        const rol = row.original;
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <ActionsMenu>
              <DropdownMenuItem onClick={() => openEdit(rol)}>
                {t("listados.common.editar")}
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/listados/roles/${rol.id}/permisos`}>
                  {t("listados.roles.editarPermisos")}
                </Link>
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
                title={t("listados.roles.eliminarPregunta", { nombre: rol.nombre })}
                description={t("listados.roles.eliminarAviso")}
                confirmLabel={t("listados.common.eliminar")}
                destructive
                onConfirm={() => onDelete(rol)}
              />
            </ActionsMenu>
          </div>
        );
      },
    },
  ];

  const title = editing
    ? `${t("listados.common.editar")} ${t("listados.roles.singular").toLowerCase()}`
    : `${t("listados.common.crear")} ${t("listados.roles.singular").toLowerCase()}`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("listados.roles.titulo")}
        description={t("listados.roles.descripcion")}
        actions={
          isAdmin ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              {t("listados.common.crear")}
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard
          icon={ShieldCheck}
          tone="neutral"
          label={t("listados.roles.kpi.total")}
          value={kpis.total.toLocaleString("es-AR")}
          caption={t("listados.roles.kpi.totalCaption")}
        />
        <KpiCard
          icon={UserCheck}
          tone="ok"
          label={t("listados.roles.kpi.asignados")}
          value={kpis.asignados.toLocaleString("es-AR")}
          caption={t("listados.roles.kpi.asignadosCaption")}
        />
        <KpiCard
          icon={UserMinus}
          tone={kpis.sinUsuarios > 0 ? "warn" : "neutral"}
          label={t("listados.roles.kpi.sinUsuarios")}
          value={kpis.sinUsuarios.toLocaleString("es-AR")}
          caption={t("listados.roles.kpi.sinUsuariosCaption")}
        />
      </div>

      <Toolbar>
        <Toolbar.Search
          value={search}
          onValueChange={setSearch}
          placeholder={t("listados.roles.buscarPlaceholder")}
        />
      </Toolbar>

      <DataTable<RolRow>
        columns={columns}
        data={filtered}
        initialSort={[{ id: "nombre", desc: false }]}
        onRowClick={isAdmin ? openEdit : undefined}
        emptyState={
          search.trim()
            ? t("listados.common.sinResultadosFiltrados")
            : isAdmin
              ? t("listados.common.vacioAdmin", {
                  entidad: t("listados.roles.plural"),
                })
              : t("listados.common.vacio", {
                  entidad: t("listados.roles.plural"),
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
                <FormLabel>{t("listados.roles.nombre")} *</FormLabel>
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
