"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/app/combobox";
import { NumberInput } from "@/components/app/number-input";
import { PageHeader } from "@/components/app/page-header";

import { crearMovimientoDiario } from "./actions";
import type { TipoLinea } from "./types";

type InventarioOpt = {
  id: number;
  codigo: string | null;
  descripcion: string | null;
  unidadMedida: string | null;
  stock: number;
  valorUnitario: number;
};

type LineaDraft = {
  itemInventarioId: number;
  unidadMedida: string | null;
  stockDisponible: number;
  cantidad: number;
  tipo: TipoLinea;
  justificacion: string;
};

function nuevaLinea(): LineaDraft {
  return {
    itemInventarioId: 0,
    unidadMedida: null,
    stockDisponible: 0,
    cantidad: 0,
    tipo: "consumible",
    justificacion: "",
  };
}

export function MovimientoForm({
  inventario,
  localidades,
  usuarioActual,
}: {
  inventario: InventarioOpt[];
  localidades: string[];
  usuarioActual: string;
}) {
  const t = useTranslations("movimientosDiarios");
  const router = useRouter();
  const [pending, start] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(today);
  const [usuario, setUsuario] = useState(usuarioActual);
  const [sector, setSector] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [lineas, setLineas] = useState<LineaDraft[]>([nuevaLinea()]);

  const inventarioOpts = inventario.map((i) => ({
    value: String(i.id),
    label: i.codigo
      ? `${i.codigo} — ${i.descripcion ?? ""}`
      : (i.descripcion ?? `#${i.id}`),
  }));
  const localidadOptions = localidades.map((l) => ({ value: l, label: l }));

  const updateLinea = (index: number, patch: Partial<LineaDraft>) => {
    setLineas((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    );
  };

  const pickItem = (index: number, itemId: number) => {
    const item = inventario.find((i) => i.id === itemId);
    if (!item) return;
    updateLinea(index, {
      itemInventarioId: item.id,
      unidadMedida: item.unidadMedida,
      stockDisponible: item.stock,
    });
  };

  const submit = () => {
    if (!fecha) {
      toast.error(t("avisos.fechaRequerida"));
      return;
    }
    const limpias = lineas.filter((l) => l.itemInventarioId > 0);
    if (limpias.length === 0) {
      toast.error(t("avisos.lineasRequeridas"));
      return;
    }
    if (limpias.some((l) => l.cantidad <= 0)) {
      toast.error(t("avisos.cantidadRequerida"));
      return;
    }
    start(async () => {
      const res = await crearMovimientoDiario({
        fecha,
        usuario,
        sector,
        localidad,
        observaciones,
        lineas: limpias.map((l) => ({
          itemInventarioId: l.itemInventarioId,
          cantidad: l.cantidad,
          tipo: l.tipo,
          justificacion: l.justificacion,
        })),
      });
      if (!res.ok) {
        if (res.error === "forbidden") {
          toast.error(t("avisos.sinPermisos"));
        } else {
          toast.error(t("avisos.errorGuardar"));
        }
        return;
      }
      toast.success(t("avisos.creado"));
      router.push(`/movimientos-diarios/${res.id}`);
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/movimientos-diarios">
            <ArrowLeft className="size-4" />
            {t("volver")}
          </Link>
        </Button>
        <PageHeader title={t("nuevoTitulo")} description={t("nuevoAyuda")} />
      </div>

      {/* Cabecera */}
      <Card className="gap-4 p-5">
        <h2 className="text-sm font-semibold">{t("secciones.cabecera")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t("campos.fecha")} *</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("campos.usuario")}</Label>
            <Input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("campos.sector")}</Label>
            <Input
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("campos.localidad")}</Label>
            <Combobox
              value={localidad}
              onChange={setLocalidad}
              options={localidadOptions}
              placeholder={t("campos.localidad")}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("campos.observaciones")}</Label>
          <Textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            maxLength={1000}
          />
        </div>
      </Card>

      {/* Líneas */}
      <Card className="gap-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{t("secciones.lineas")}</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLineas((prev) => [...prev, nuevaLinea()])}
          >
            <Plus className="size-4" />
            {t("lineas.agregar")}
          </Button>
        </div>
        <p className="text-xs text-subtle-foreground">{t("lineas.ayuda")}</p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10.5px] font-semibold uppercase tracking-wide text-subtle-foreground">
                <th className="py-2 pr-2">{t("lineas.item")}</th>
                <th className="py-2 pr-2">{t("lineas.cantidad")}</th>
                <th className="py-2 pr-2">{t("lineas.tipo")}</th>
                <th className="py-2 pr-2">{t("lineas.justificacion")}</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((linea, index) => {
                const over =
                  linea.itemInventarioId > 0 &&
                  linea.cantidad > linea.stockDisponible;
                return (
                  <tr
                    key={index}
                    className="border-b border-dashed border-border align-top last:border-b-0"
                  >
                    <td className="py-2 pr-2">
                      <Combobox
                        value={
                          linea.itemInventarioId
                            ? String(linea.itemInventarioId)
                            : ""
                        }
                        onChange={(v) =>
                          v ? pickItem(index, Number(v)) : null
                        }
                        options={inventarioOpts}
                        placeholder={t("lineas.item")}
                        allowCreate={false}
                      />
                      {linea.itemInventarioId > 0 ? (
                        <span className="mt-1 block text-xs text-subtle-foreground">
                          {t("lineas.stockDisponible", {
                            stock: linea.stockDisponible,
                            unidad: linea.unidadMedida ?? "",
                          })}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2">
                      <NumberInput
                        step={0.01}
                        min={0}
                        value={linea.cantidad}
                        onChange={(v) =>
                          updateLinea(index, { cantidad: v === "" ? 0 : v })
                        }
                        className="w-24"
                      />
                      {over ? (
                        <span className="mt-1 block text-xs text-destructive">
                          {t("lineas.sobreStock")}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2">
                      <Select
                        value={linea.tipo}
                        onValueChange={(v) =>
                          updateLinea(index, { tipo: v as TipoLinea })
                        }
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="consumible">
                            {t("tipo.consumible")}
                          </SelectItem>
                          <SelectItem value="herramienta">
                            {t("tipo.herramienta")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 pr-2">
                      <Input
                        value={linea.justificacion}
                        onChange={(e) =>
                          updateLinea(index, {
                            justificacion: e.target.value,
                          })
                        }
                        placeholder={
                          linea.tipo === "herramienta"
                            ? t("lineas.justificacionHerramienta")
                            : t("lineas.justificacionOpcional")
                        }
                        maxLength={500}
                      />
                    </td>
                    <td className="py-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setLineas((prev) =>
                            prev.filter((_, i) => i !== index),
                          )
                        }
                        aria-label={t("lineas.eliminar")}
                        className="size-7 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="sticky bottom-4 flex items-center justify-end gap-2 rounded-xl border border-border bg-card px-5 py-3 shadow-sm">
        <Button variant="outline" size="sm" asChild>
          <Link href="/movimientos-diarios">{t("cancelar")}</Link>
        </Button>
        <Button size="sm" onClick={submit} disabled={pending}>
          {t("guardar")}
        </Button>
      </div>
    </div>
  );
}
