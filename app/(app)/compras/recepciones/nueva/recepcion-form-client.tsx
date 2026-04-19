"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, CheckCheck, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";

import { PageHeader } from "@/components/app/page-header";

import { createRecepcion } from "../actions";

export type RecepcionFormLinea = {
  id: number;
  orden: number;
  itemCodigo: string;
  itemDescripcion: string;
  unidadMedida: string | null;
  cantidadSolicitada: number;
  cantidadRecibida: number;
  precioUnitario: number;
};

export type RecepcionFormOc = {
  id: number;
  numeroOc: string;
  proveedor: string;
};

type LineaState = {
  id: number;
  cantidad: string;
  destino: "Stock" | "Directa";
  observaciones: string;
};

function todayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function RecepcionFormClient({
  oc,
  lineas: initialLineas,
  defaultRecibidoPor,
}: {
  oc: RecepcionFormOc;
  lineas: RecepcionFormLinea[];
  defaultRecibidoPor: string;
}) {
  const tRec = useTranslations("compras.recepciones");
  const tCommon = useTranslations("listados.common");
  const router = useRouter();

  const [numeroRemito, setNumeroRemito] = useState("");
  const [fecha, setFecha] = useState<string>(todayISODate());
  const [recibidoPor, setRecibidoPor] = useState(defaultRecibidoPor);
  const [observaciones, setObservaciones] = useState("");
  const [lineState, setLineState] = useState<LineaState[]>(() =>
    initialLineas.map((l) => ({
      id: l.id,
      cantidad: "",
      destino: "Stock" as const,
      observaciones: "",
    })),
  );
  const [isSaving, startSave] = useTransition();

  const pendientesById = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of initialLineas) {
      m.set(l.id, Math.max(0, l.cantidadSolicitada - l.cantidadRecibida));
    }
    return m;
  }, [initialLineas]);

  function updateLinea(id: number, patch: Partial<LineaState>) {
    setLineState((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
  }

  function recibirTodo() {
    setLineState((prev) =>
      prev.map((l) => {
        const p = pendientesById.get(l.id) ?? 0;
        return { ...l, cantidad: p > 0 ? String(p) : "" };
      }),
    );
  }

  const activeRows = lineState.filter((l) => {
    const n = Number(l.cantidad);
    return Number.isFinite(n) && n > 0;
  });

  const stockEntradas = activeRows.filter((l) => l.destino === "Stock").length;
  const directas = activeRows.filter((l) => l.destino === "Directa").length;

  const overReception = lineState.some((l) => {
    const n = Number(l.cantidad);
    if (!Number.isFinite(n) || n <= 0) return false;
    const p = pendientesById.get(l.id) ?? 0;
    return n > p + 1e-9;
  });

  const saldoAllFull = useMemo(() => {
    return initialLineas.every((l) => {
      const st = lineState.find((s) => s.id === l.id);
      const n = st ? Number(st.cantidad) : 0;
      const afterRecv = l.cantidadRecibida + (Number.isFinite(n) ? n : 0);
      return afterRecv >= l.cantidadSolicitada - 1e-9;
    });
  }, [initialLineas, lineState]);

  const canSave =
    !isSaving &&
    numeroRemito.trim().length > 0 &&
    recibidoPor.trim().length > 0 &&
    activeRows.length > 0 &&
    !overReception;

  function handleSave() {
    startSave(async () => {
      const payload = {
        ocId: oc.id,
        numeroRemito: numeroRemito.trim(),
        fechaRecepcion: new Date(fecha),
        recibidoPor: recibidoPor.trim(),
        observaciones: observaciones.trim() || null,
        lineas: lineState
          .filter((l) => {
            const n = Number(l.cantidad);
            return Number.isFinite(n) && n > 0;
          })
          .map((l) => ({
            ocDetalleId: l.id,
            cantidadRecibidaAhora: Number(l.cantidad),
            destino: l.destino,
            observaciones: l.observaciones.trim() || null,
          })),
      };
      const result = await createRecepcion(payload);
      if (result.ok) {
        toast.success(tRec("avisos.creadaExitoso", { id: result.id }));
        router.push(`/compras/recepciones/${result.id}`);
        router.refresh();
      } else if (result.error === "over_reception") {
        toast.error(tRec("avisos.sobreRecepcion"));
      } else if (result.error === "wrong_estado") {
        toast.error(tRec("avisos.ocNoRecibible"));
      } else if (result.error === "nothing_to_receive") {
        toast.error(tRec("avisos.nadaParaRecibir"));
      } else if (result.error === "forbidden") {
        toast.error(tCommon("errorForbidden"));
      } else if (result.error === "invalid") {
        toast.error(tCommon("errorGuardar"));
      } else {
        toast.error(tCommon("errorGuardar"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/compras/oc/${oc.id}`}>
            <ArrowLeft className="size-4" />
            {oc.numeroOc}
          </Link>
        </Button>
        <PageHeader
          title={tRec("nuevaTitulo", {
            numero: oc.numeroOc,
            proveedor: oc.proveedor,
          })}
          description={tRec("nuevaDescripcion")}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={recibirTodo}
                disabled={isSaving}
              >
                <CheckCheck className="size-4" />
                {tRec("acciones.recibirTodo")}
              </Button>
              <Button type="button" onClick={handleSave} disabled={!canSave}>
                <Save className="size-4" />
                {tRec("acciones.guardar")}
              </Button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="md:col-span-1">
          <Label htmlFor="numeroRemito">{tRec("campos.remito")}</Label>
          <Input
            id="numeroRemito"
            value={numeroRemito}
            onChange={(e) => setNumeroRemito(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className="md:col-span-1">
          <Label htmlFor="fechaRecepcion">{tRec("campos.fecha")}</Label>
          <Input
            id="fechaRecepcion"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className="md:col-span-1">
          <Label htmlFor="recibidoPor">{tRec("campos.recibidoPor")}</Label>
          <Input
            id="recibidoPor"
            value={recibidoPor}
            onChange={(e) => setRecibidoPor(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className="md:col-span-4">
          <Label htmlFor="observaciones">{tRec("campos.observaciones")}</Label>
          <Textarea
            id="observaciones"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            disabled={isSaving}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left font-medium w-10">#</th>
              <th className="px-2 py-2 text-left font-medium">
                {tRec("columnas.descripcion")}
              </th>
              <th className="px-2 py-2 text-right font-medium w-20">
                {tRec("columnas.pendiente")}
              </th>
              <th className="px-2 py-2 text-right font-medium w-28">
                {tRec("columnas.recibirAhora")}
              </th>
              <th className="px-2 py-2 text-left font-medium w-40">
                {tRec("columnas.destino")}
              </th>
              <th className="px-2 py-2 text-left font-medium">
                {tRec("columnas.observaciones")}
              </th>
            </tr>
          </thead>
          <tbody>
            {initialLineas.map((l) => {
              const st = lineState.find((s) => s.id === l.id)!;
              const pendiente = pendientesById.get(l.id) ?? 0;
              const n = Number(st.cantidad);
              const invalid =
                st.cantidad !== "" &&
                (!Number.isFinite(n) || n < 0 || n > pendiente + 1e-9);
              return (
                <tr key={l.id} className="border-t border-border align-top">
                  <td className="px-2 py-2 text-xs text-muted-foreground tabular-nums">
                    {l.orden}
                  </td>
                  <td className="px-2 py-2">
                    <div className="font-medium">
                      {l.itemDescripcion || "—"}
                    </div>
                    {l.itemCodigo ? (
                      <div className="font-mono text-xs text-muted-foreground">
                        {l.itemCodigo}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {pendiente}
                    {l.unidadMedida ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        {l.unidadMedida}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      max={pendiente}
                      value={st.cantidad}
                      onChange={(e) =>
                        updateLinea(l.id, { cantidad: e.target.value })
                      }
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v) || v <= 0) {
                          updateLinea(l.id, { cantidad: "" });
                          return;
                        }
                        updateLinea(l.id, { cantidad: v.toFixed(2) });
                      }}
                      disabled={isSaving || pendiente <= 0}
                      className={
                        invalid ? "border-destructive focus-visible:ring-destructive" : ""
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <RadioGroup
                      value={st.destino}
                      onValueChange={(v) =>
                        updateLinea(l.id, {
                          destino: v as "Stock" | "Directa",
                        })
                      }
                      disabled={isSaving}
                      className="flex gap-3"
                    >
                      <Label className="flex items-center gap-1 text-xs">
                        <RadioGroupItem value="Stock" /> {tRec("destinos.Stock")}
                      </Label>
                      <Label className="flex items-center gap-1 text-xs">
                        <RadioGroupItem value="Directa" />{" "}
                        {tRec("destinos.Directa")}
                      </Label>
                    </RadioGroup>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={st.observaciones}
                      onChange={(e) =>
                        updateLinea(l.id, { observaciones: e.target.value })
                      }
                      disabled={isSaving}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
        {activeRows.length === 0
          ? tRec("resumen.sinLineas")
          : tRec("resumen.detalle", {
              saldo: saldoAllFull
                ? tRec("resumen.completa")
                : tRec("resumen.parcial"),
              stock: stockEntradas,
              directa: directas,
            })}
      </div>
    </div>
  );
}
