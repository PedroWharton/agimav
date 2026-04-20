"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { Combobox } from "@/components/app/combobox";
import { DataTable } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { PageHeader } from "@/components/app/page-header";
import { Toolbar } from "@/components/app/toolbar";

import { createRegistroHoras } from "./actions";

export type RegistroRow = {
  id: number;
  maquinariaId: number;
  maquinaria: string;
  fechaRegistro: string;
  horasAnterior: number;
  horasNuevo: number;
  horasDiferencia: number;
  tipoActualizacion: string | null;
  observaciones: string | null;
  usuario: string | null;
};

export type MaquinariaOption = {
  id: number;
  label: string;
  horasAcumuladas: number;
};

const ALL = "__all__";

function todayISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const formSchema = z.object({
  maquinariaId: z.string().min(1, "Obligatorio"),
  horasNuevo: z
    .string()
    .trim()
    .min(1, "Obligatorio")
    .refine((v) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0;
    }, "Valor inválido"),
  fechaRegistro: z.string().trim().min(1, "Obligatorio"),
  observaciones: z.string().trim().max(500).optional(),
});
type FormValues = z.infer<typeof formSchema>;

const emptyForm: FormValues = {
  maquinariaId: "",
  horasNuevo: "",
  fechaRegistro: todayISODate(),
  observaciones: "",
};

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function HorometrosClient({
  rows,
  maquinarias,
}: {
  rows: RegistroRow[];
  maquinarias: MaquinariaOption[];
}) {
  const tM = useTranslations("mantenimiento");
  const tH = useTranslations("mantenimiento.horometros");
  const router = useRouter();
  const [pending, start] = useTransition();

  const [maquinariaFilter, setMaquinariaFilter] = useState(ALL);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: emptyForm,
  });

  const maquinariaOpts = useMemo(
    () => maquinarias.map((m) => ({ value: String(m.id), label: m.label })),
    [maquinarias],
  );

  const maquinariaById = useMemo(() => {
    const map = new Map<number, MaquinariaOption>();
    for (const m of maquinarias) map.set(m.id, m);
    return map;
  }, [maquinarias]);

  const filtered = useMemo(() => {
    let out = rows;
    if (maquinariaFilter !== ALL) {
      out = out.filter((r) => String(r.maquinariaId) === maquinariaFilter);
    }
    const q = search.trim();
    if (q) {
      const qn = norm(q);
      out = out.filter(
        (r) =>
          norm(r.maquinaria).includes(qn) ||
          norm(r.usuario).includes(qn) ||
          norm(r.observaciones).includes(qn),
      );
    }
    return out;
  }, [rows, maquinariaFilter, search]);

  function openCreate() {
    form.reset(emptyForm);
    setOpen(true);
  }

  function submit() {
    form.handleSubmit((values) => {
      start(async () => {
        const res = await createRegistroHoras({
          maquinariaId: Number(values.maquinariaId),
          horasNuevo: Number(values.horasNuevo),
          fechaRegistro: values.fechaRegistro,
          tipoActualizacion: "manual",
          observaciones: values.observaciones ?? "",
        });
        if (!res.ok) {
          if (res.error === "forbidden") {
            toast.error(tM("avisos.sinPermisos"));
            return;
          }
          if (res.fieldErrors) {
            for (const [k, msg] of Object.entries(res.fieldErrors)) {
              form.setError(k as keyof FormValues, { message: msg });
            }
            return;
          }
          toast.error(tM("avisos.errorGenerico"));
          return;
        }
        toast.success(tH("avisos.creadoExitoso"));
        setOpen(false);
        router.refresh();
      });
    })();
  }

  const columns: ColumnDef<RegistroRow>[] = [
    {
      accessorKey: "fechaRegistro",
      header: tH("columnas.fecha"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {format(new Date(row.original.fechaRegistro), "dd/MM/yyyy", {
            locale: es,
          })}
        </span>
      ),
    },
    {
      accessorKey: "maquinaria",
      header: tH("columnas.maquina"),
      enableSorting: true,
    },
    {
      accessorKey: "horasAnterior",
      header: tH("columnas.horasAnterior"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.horasAnterior}
        </span>
      ),
    },
    {
      accessorKey: "horasNuevo",
      header: tH("columnas.horasNuevo"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">
          {row.original.horasNuevo}
        </span>
      ),
    },
    {
      accessorKey: "horasDiferencia",
      header: tH("columnas.diferencia"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          +{row.original.horasDiferencia}
        </span>
      ),
    },
    {
      accessorKey: "usuario",
      header: tH("columnas.usuario"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.usuario ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "observaciones",
      header: tH("columnas.observaciones"),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.observaciones ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={tH("titulo")}
        description={tH("descripcion")}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {tH("nuevo")}
          </Button>
        }
      />

      <Toolbar>
        <Toolbar.Search
          value={search}
          onValueChange={setSearch}
          placeholder={tH("buscarPlaceholder")}
        />
        <Toolbar.Selects>
          <Combobox
            value={maquinariaFilter === ALL ? "" : maquinariaFilter}
            onChange={(v) => setMaquinariaFilter(v || ALL)}
            options={[
              { value: "", label: tM("filtros.todos") },
              ...maquinariaOpts,
            ]}
            placeholder={tM("campos.maquina")}
            allowCreate={false}
            className="h-9 w-[260px]"
          />
        </Toolbar.Selects>
      </Toolbar>

      <DataTable<RegistroRow>
        columns={columns}
        data={filtered}
        initialSort={[{ id: "fechaRegistro", desc: true }]}
        emptyState={tH("vacio")}
      />

      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={tH("nuevoTitulo")}
        description={tH("nuevoDescripcion")}
        isDirty={form.formState.isDirty}
        isSubmitting={pending}
        submitLabel={tH("registrar")}
        onSubmit={submit}
      >
        <Form {...form}>
          <FormField
            control={form.control}
            name="maquinariaId"
            render={({ field }) => {
              const selected = field.value
                ? (maquinariaById.get(Number(field.value)) ?? null)
                : null;
              return (
                <FormItem>
                  <FormLabel>{tM("campos.maquina")} *</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value}
                      onChange={(v) => field.onChange(v)}
                      options={maquinariaOpts}
                      placeholder={tM("campos.maquina")}
                      allowCreate={false}
                    />
                  </FormControl>
                  {selected ? (
                    <span className="text-xs text-muted-foreground">
                      {tH("horasActuales", {
                        valor: selected.horasAcumuladas,
                      })}
                    </span>
                  ) : null}
                  <FormMessage />
                </FormItem>
              );
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="horasNuevo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tH("campos.horasNuevo")} *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      className="tabular-nums"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fechaRegistro"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tH("campos.fechaRegistro")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
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
                <FormLabel>{tH("campos.observaciones")}</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={3}
                    placeholder={tH("campos.observacionesPlaceholder")}
                  />
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
