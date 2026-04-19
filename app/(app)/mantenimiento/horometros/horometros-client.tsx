"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Combobox } from "@/components/app/combobox";
import { DataTable } from "@/components/app/data-table";
import { PageHeader } from "@/components/app/page-header";

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

  const [open, setOpen] = useState(false);
  const [maquinariaId, setMaquinariaId] = useState<number | null>(null);
  const [horasNuevo, setHorasNuevo] = useState("");
  const [fechaRegistro, setFechaRegistro] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const maquinariaOpts = useMemo(
    () => maquinarias.map((m) => ({ value: String(m.id), label: m.label })),
    [maquinarias],
  );

  const selectedMaquinaria = useMemo(
    () => maquinarias.find((m) => m.id === maquinariaId) ?? null,
    [maquinarias, maquinariaId],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (
        maquinariaFilter !== ALL &&
        String(r.maquinariaId) !== maquinariaFilter
      ) {
        return false;
      }
      return true;
    });
  }, [rows, maquinariaFilter]);

  const resetForm = () => {
    setMaquinariaId(null);
    setHorasNuevo("");
    setFechaRegistro("");
    setObservaciones("");
    setFieldErrors({});
  };

  const submit = () => {
    setFieldErrors({});
    if (!maquinariaId) {
      setFieldErrors({ maquinariaId: tH("avisos.campoRequerido") });
      return;
    }
    const horasNum = Number(horasNuevo);
    if (!Number.isFinite(horasNum) || horasNum < 0) {
      setFieldErrors({ horasNuevo: tH("avisos.campoRequerido") });
      return;
    }
    start(async () => {
      const res = await createRegistroHoras({
        maquinariaId,
        horasNuevo: horasNum,
        fechaRegistro,
        tipoActualizacion: "manual",
        observaciones,
      });
      if (!res.ok) {
        if (res.error === "forbidden") {
          toast.error(tM("avisos.sinPermisos"));
          return;
        }
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
          return;
        }
        toast.error(tM("avisos.errorGenerico"));
        return;
      }
      toast.success(tH("avisos.creadoExitoso"));
      setOpen(false);
      resetForm();
      router.refresh();
    });
  };

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
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                {tH("nuevo")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{tH("nuevoTitulo")}</DialogTitle>
                <DialogDescription>
                  {tH("nuevoDescripcion")}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>{tM("campos.maquina")} *</Label>
                  <Combobox
                    value={maquinariaId ? String(maquinariaId) : ""}
                    onChange={(v) => setMaquinariaId(v ? Number(v) : null)}
                    options={maquinariaOpts}
                    placeholder={tM("campos.maquina")}
                    allowCreate={false}
                  />
                  {selectedMaquinaria ? (
                    <span className="text-xs text-muted-foreground">
                      {tH("horasActuales", {
                        valor: selectedMaquinaria.horasAcumuladas,
                      })}
                    </span>
                  ) : null}
                  {fieldErrors.maquinariaId ? (
                    <span className="text-xs text-destructive">
                      {fieldErrors.maquinariaId}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{tH("campos.horasNuevo")} *</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={horasNuevo}
                    onChange={(e) => setHorasNuevo(e.target.value)}
                  />
                  {fieldErrors.horasNuevo ? (
                    <span className="text-xs text-destructive">
                      {fieldErrors.horasNuevo}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{tH("campos.fechaRegistro")}</Label>
                  <Input
                    type="date"
                    value={fechaRegistro}
                    onChange={(e) => setFechaRegistro(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{tH("campos.observaciones")}</Label>
                  <Textarea
                    rows={3}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder={tH("campos.observacionesPlaceholder")}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
                  disabled={pending}
                >
                  {tM("acciones.cancelarDialogo")}
                </Button>
                <Button
                  onClick={submit}
                  disabled={pending || !maquinariaId || !horasNuevo}
                >
                  {tH("registrar")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <DataTable<RegistroRow>
        columns={columns}
        data={filtered}
        searchableKeys={["maquinaria", "usuario", "observaciones"]}
        searchPlaceholder={tH("buscarPlaceholder")}
        initialSort={[{ id: "fechaRegistro", desc: true }]}
        filterSlot={
          <div className="flex flex-wrap items-center gap-3">
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
            <span className="text-sm text-muted-foreground">
              {tH("resultadosCount", { count: filtered.length })}
            </span>
          </div>
        }
        emptyState={tH("vacio")}
      />
    </div>
  );
}
