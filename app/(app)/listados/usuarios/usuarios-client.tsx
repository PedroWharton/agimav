"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Copy, Link as LinkIcon } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { DataTable } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { ActionsMenu } from "@/components/app/actions-menu";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageHeader } from "@/components/app/page-header";

import {
  createUsuario,
  updateUsuario,
  deactivateUsuario,
  reactivateUsuario,
  regenerateInvite,
  type InviteInfo,
} from "./actions";

export type UsuarioRow = {
  id: number;
  nombre: string;
  email: string | null;
  estado: string;
  rolId: number | null;
  rolNombre: string | null;
  createdAt: Date;
};

export type RolOption = { id: number; nombre: string };

const UNASSIGNED = "__none__";

const formSchema = z.object({
  nombre: z.string().trim().min(1, "Obligatorio").max(200),
  email: z
    .string()
    .trim()
    .min(1, "Obligatorio")
    .email("Email inválido")
    .max(200),
  rolId: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

type EstadoFilter = "activos" | "inactivos" | "todos";

type ShownInvite = InviteInfo & {
  nombre: string;
  origin: "created" | "regenerated";
};

function buildInviteUrl(token: string): string {
  if (typeof window === "undefined") return `/invitacion/${token}`;
  return `${window.location.origin}/invitacion/${token}`;
}

export function UsuariosClient({
  rows,
  roles,
  isAdmin,
  currentUserId,
}: {
  rows: UsuarioRow[];
  roles: RolOption[];
  isAdmin: boolean;
  currentUserId: number | null;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UsuarioRow | null>(null);
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("activos");
  const [invite, setInvite] = useState<ShownInvite | null>(null);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: { nombre: "", email: "", rolId: UNASSIGNED },
  });

  const [isSubmitting, startSubmit] = useTransition();

  const filtered = useMemo(() => {
    if (estadoFilter === "todos") return rows;
    const want = estadoFilter === "activos" ? "activo" : "inactivo";
    return rows.filter((r) => r.estado === want);
  }, [rows, estadoFilter]);

  function openCreate() {
    setEditing(null);
    form.reset({ nombre: "", email: "", rolId: UNASSIGNED });
    setOpen(true);
  }

  function openEdit(row: UsuarioRow) {
    setEditing(row);
    form.reset({
      nombre: row.nombre,
      email: row.email ?? "",
      rolId: row.rolId == null ? UNASSIGNED : String(row.rolId),
    });
    setOpen(true);
  }

  function submit() {
    form.handleSubmit((values) => {
      startSubmit(async () => {
        const payload = {
          nombre: values.nombre,
          email: values.email,
          rolId: values.rolId === UNASSIGNED ? null : Number(values.rolId),
        };
        const result = editing
          ? await updateUsuario(editing.id, payload)
          : await createUsuario(payload);
        if (result.ok) {
          toast.success(
            editing
              ? t("listados.common.actualizadoExitoso", {
                  entidad: t("listados.usuarios.singular"),
                  nombre: values.nombre,
                })
              : t("listados.common.creadoExitoso", {
                  entidad: t("listados.usuarios.singular"),
                  nombre: values.nombre,
                }),
          );
          setOpen(false);
          if (!editing && result.invite) {
            setInvite({
              ...result.invite,
              nombre: values.nombre,
              origin: "created",
            });
          }
        } else if (result.error === "duplicate_email") {
          form.setError("email", {
            message: t("listados.usuarios.errores.emailDuplicado"),
          });
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

  async function onRegenerate(row: UsuarioRow) {
    const result = await regenerateInvite(row.id);
    if (result.ok) {
      if (result.invite) {
        setInvite({
          ...result.invite,
          nombre: row.nombre,
          origin: "regenerated",
        });
        toast.success(t("listados.usuarios.invitacion.regenerado"));
      }
      return;
    }
    if (result.error === "forbidden") {
      toast.error(t("listados.common.errorForbidden"));
    } else {
      toast.error(t("listados.common.errorGuardar"));
    }
  }

  async function onDeactivate(row: UsuarioRow) {
    const result = await deactivateUsuario(row.id);
    if (result.ok) {
      toast.success(
        t("listados.common.desactivadoExitoso", {
          entidad: t("listados.usuarios.singular"),
          nombre: row.nombre,
        }),
      );
    } else if (result.error === "no_self_deactivate") {
      toast.error(t("listados.usuarios.errores.noAutoBaja"));
    } else if (result.error === "last_admin") {
      toast.error(t("listados.usuarios.errores.ultimoAdmin"));
    } else if (result.error === "forbidden") {
      toast.error(t("listados.common.errorForbidden"));
    } else {
      toast.error(t("listados.common.errorGuardar"));
    }
  }

  async function onReactivate(row: UsuarioRow) {
    const result = await reactivateUsuario(row.id);
    if (result.ok) {
      toast.success(
        t("listados.common.reactivadoExitoso", {
          entidad: t("listados.usuarios.singular"),
          nombre: row.nombre,
        }),
      );
    } else if (result.error === "forbidden") {
      toast.error(t("listados.common.errorForbidden"));
    } else {
      toast.error(t("listados.common.errorGuardar"));
    }
  }

  const columns: ColumnDef<UsuarioRow>[] = [
    {
      accessorKey: "nombre",
      header: t("listados.usuarios.nombre"),
      enableSorting: true,
    },
    {
      accessorKey: "email",
      header: t("listados.usuarios.email"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.email ?? "—"}</span>
      ),
    },
    {
      accessorKey: "rolNombre",
      header: t("listados.usuarios.rol"),
      enableSorting: true,
      cell: ({ row }) =>
        row.original.rolNombre ? (
          <span>{row.original.rolNombre}</span>
        ) : (
          <span className="text-muted-foreground">
            {t("listados.usuarios.sinRol")}
          </span>
        ),
    },
    {
      accessorKey: "estado",
      header: t("listados.usuarios.estado"),
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
        const isSelf = currentUserId === u.id;
        const activo = u.estado === "activo";
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <ActionsMenu>
              <DropdownMenuItem onClick={() => openEdit(u)}>
                {t("listados.common.editar")}
              </DropdownMenuItem>
              {activo ? (
                <ConfirmDialog
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <LinkIcon className="size-4" />
                      {t("listados.usuarios.invitacion.regenerar")}
                    </DropdownMenuItem>
                  }
                  title={t("listados.usuarios.invitacion.confirmarRegenerar")}
                  description={t(
                    "listados.usuarios.invitacion.confirmarRegenerarDesc",
                  )}
                  confirmLabel={t("listados.usuarios.invitacion.regenerar")}
                  onConfirm={() => onRegenerate(u)}
                />
              ) : null}
              <DropdownMenuSeparator />
              {activo ? (
                <ConfirmDialog
                  trigger={
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      disabled={isSelf}
                      className="text-destructive focus:text-destructive"
                    >
                      {t("listados.common.desactivar")}
                    </DropdownMenuItem>
                  }
                  title={`¿Desactivar a "${u.nombre}"?`}
                  description="El usuario no podrá iniciar sesión pero sus registros se conservan. Podés reactivarlo más tarde."
                  confirmLabel={t("listados.common.desactivar")}
                  destructive
                  onConfirm={() => onDeactivate(u)}
                />
              ) : (
                <DropdownMenuItem onClick={() => onReactivate(u)}>
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
    ? `${t("listados.common.editar")} ${t("listados.usuarios.singular").toLowerCase()}`
    : `${t("listados.common.crear")} ${t("listados.usuarios.singular").toLowerCase()}`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("listados.usuarios.titulo")}
        description={t("listados.usuarios.descripcion")}
        actions={
          isAdmin ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              {t("listados.common.crear")}
            </Button>
          ) : null
        }
      />

      <DataTable<UsuarioRow>
        columns={columns}
        data={filtered}
        searchableKeys={["nombre", "email", "rolNombre"]}
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
                entidad: t("listados.usuarios.plural"),
              })
            : t("listados.common.vacio", {
                entidad: t("listados.usuarios.plural"),
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
                <FormLabel>{t("listados.usuarios.nombre")} *</FormLabel>
                <FormControl>
                  <Input {...field} autoFocus />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("listados.usuarios.email")} *</FormLabel>
                <FormControl>
                  <Input {...field} type="email" autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="rolId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("listados.usuarios.rol")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>
                      {t("listados.usuarios.sinRol")}
                    </SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.nombre}
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

      <InviteDialog
        invite={invite}
        onOpenChange={(o) => {
          if (!o) setInvite(null);
        }}
      />
    </div>
  );
}

function InviteDialog({
  invite,
  onOpenChange,
}: {
  invite: ShownInvite | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("listados.usuarios.invitacion");
  const open = invite !== null;
  const url = invite ? buildInviteUrl(invite.token) : "";
  const fecha = invite
    ? format(new Date(invite.expiresAt), "d 'de' MMMM", { locale: es })
    : "";

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("copiado"));
    } catch {
      toast.error(t("copiarError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("titulo")}</DialogTitle>
          <DialogDescription>
            {invite?.origin === "regenerated"
              ? t("ayudaRegenerar", { fecha })
              : t("ayudaNuevo", { fecha })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input readOnly value={url} className="font-mono text-xs" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={copyToClipboard}
            aria-label={t("copiar")}
          >
            <Copy className="size-4" />
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t("cerrar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
