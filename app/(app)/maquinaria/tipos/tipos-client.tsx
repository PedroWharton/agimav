"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ChevronRight,
  CircleDot,
  GitBranch,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Tags,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

import { FormSheet } from "@/components/app/form-sheet";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageHeader } from "@/components/app/page-header";
import { Toolbar } from "@/components/app/toolbar";
import { KpiCard } from "@/components/stats/kpi-card";

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

export type TiposKpis = {
  total: number;
  activos: number;
  inactivos: number;
  instanciasTotales: number;
  atributosTotales: number;
};

type EstadoFilter = "activos" | "inactivos" | "todos";

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

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function TiposClient({
  rows,
  kpis,
}: {
  rows: TipoRow[];
  kpis: TiposKpis;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TipoRow | null>(null);
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("activos");
  const [search, setSearch] = useState("");

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: emptyForm,
  });

  const [isSubmitting, startSubmit] = useTransition();

  const filtered = useMemo(() => {
    let out = rows;
    if (estadoFilter !== "todos") {
      const want = estadoFilter === "activos" ? "activo" : "inactivo";
      out = out.filter((r) =>
        want === "activo" ? r.estado !== "inactivo" : r.estado === "inactivo",
      );
    }
    const q = search.trim();
    if (q) {
      const qn = norm(q);
      out = out.filter(
        (r) =>
          norm(r.nombre).includes(qn) ||
          norm(r.unidadMedicion).includes(qn) ||
          norm(r.abrevUnidad).includes(qn),
      );
    }
    return out;
  }, [rows, estadoFilter, search]);

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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={Tags}
          tone="neutral"
          label={t("maquinaria.tipos.kpi.total")}
          value={kpis.total.toLocaleString("es-AR")}
          caption={t("maquinaria.tipos.kpi.totalCaption", {
            activos: kpis.activos,
            inactivos: kpis.inactivos,
          })}
        />
        <KpiCard
          icon={Truck}
          tone="info"
          label={t("maquinaria.tipos.kpi.instancias")}
          value={kpis.instanciasTotales.toLocaleString("es-AR")}
          caption={t("maquinaria.tipos.kpi.instanciasCaption")}
        />
        <KpiCard
          icon={Layers}
          tone="neutral"
          label={t("maquinaria.tipos.kpi.atributos")}
          value={kpis.atributosTotales.toLocaleString("es-AR")}
          caption={t("maquinaria.tipos.kpi.atributosCaption")}
        />
        <KpiCard
          icon={CircleDot}
          tone={kpis.inactivos > 0 ? "warn" : "ok"}
          label={t("maquinaria.tipos.kpi.estado")}
          value={kpis.activos.toLocaleString("es-AR")}
          caption={t("maquinaria.tipos.kpi.estadoCaption", {
            inactivos: kpis.inactivos,
          })}
        />
      </div>

      <Toolbar>
        <Toolbar.Search
          value={search}
          onValueChange={setSearch}
          placeholder={t("maquinaria.tipos.buscarPlaceholder")}
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

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {search.trim()
            ? t("listados.common.sinResultados", { query: search.trim() })
            : t("listados.common.vacioAdmin", {
                entidad: t("maquinaria.tipos.plural"),
              })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((tipo) => (
            <TipoTile
              key={tipo.id}
              tipo={tipo}
              onEdit={() => openEdit(tipo)}
              onDelete={() => onDelete(tipo)}
              t={t}
            />
          ))}
        </div>
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

type Translator = ReturnType<typeof useTranslations>;

function TipoTile({
  tipo,
  onEdit,
  onDelete,
  t,
}: {
  tipo: TipoRow;
  onEdit: () => void;
  onDelete: () => void;
  t: Translator;
}) {
  const inactivo = tipo.estado === "inactivo";
  const unidad = tipo.unidadMedicion
    ? `${tipo.unidadMedicion}${tipo.abrevUnidad ? ` (${tipo.abrevUnidad})` : ""}`
    : null;

  return (
    <div className="group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-border-strong hover:bg-muted-2 focus-within:ring-2 focus-within:ring-ring">
      <Link
        href={`/maquinaria/${tipo.id}`}
        className="absolute inset-0 rounded-lg focus-visible:outline-none"
        aria-label={t("maquinaria.tipos.abrir", { nombre: tipo.nombre })}
      />

      <div className="relative z-10 flex items-start justify-between">
        <div className="rounded-md bg-brand-weak p-2 text-brand">
          <Truck className="size-5" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-1">
          {inactivo ? (
            <Badge variant="secondary">
              {t("listados.common.estadoInactivo")}
            </Badge>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative size-8 shrink-0 text-muted-foreground"
                aria-label={t("maquinaria.tipos.accionesTitulo", {
                  nombre: tipo.nombre,
                })}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/maquinaria/tipos/${tipo.id}/estructura`}>
                  <GitBranch className="size-4" />
                  {t("maquinaria.tipos.verEstructura")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="size-4" />
                {t("listados.common.editar")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
                onConfirm={onDelete}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="relative z-10 flex flex-col gap-1 pointer-events-none">
        <span className="text-sm font-medium">{tipo.nombre}</span>
        <span className="font-heading text-3xl font-semibold leading-none tabular-nums">
          {tipo.instanciasCount.toLocaleString("es-AR")}
        </span>
        <span className="text-xs text-subtle-foreground">
          {t("maquinaria.tipos.kpi.instanciasLabel", {
            count: tipo.instanciasCount,
          })}
          {unidad ? ` · ${unidad}` : ""}
        </span>
      </div>

      <div className="relative z-10 flex items-center justify-between text-xs text-subtle-foreground pointer-events-none">
        <span>
          {t("maquinaria.tipos.nivelesCount", { count: tipo.nivelesCount })}
          <span className="mx-1">·</span>
          {t("maquinaria.tipos.atributosCount", {
            count: tipo.atributosCount,
          })}
        </span>
        <ChevronRight
          className="size-4 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
