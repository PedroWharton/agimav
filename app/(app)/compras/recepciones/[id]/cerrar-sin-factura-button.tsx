"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NumberInput } from "@/components/app/number-input";

import { cerrarRecepcionSinFactura } from "../actions";

export type CerrarSinFacturaLinea = {
  id: number;
  itemCodigo: string;
  itemDescripcion: string;
  unidadMedida: string | null;
  cantidadRecibida: number;
};

export function CerrarSinFacturaButton({
  recepcionId,
  lineas,
}: {
  recepcionId: number;
  lineas: CerrarSinFacturaLinea[];
}) {
  const tRec = useTranslations("compras.recepciones");
  const tCommon = useTranslations("listados.common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [precios, setPrecios] = useState<Record<number, number | "">>({});
  const [pending, startTransition] = useTransition();

  const motivoTrim = motivo.trim();
  const canSubmit = !pending && motivoTrim.length > 0;

  function reset() {
    setMotivo("");
    setPrecios({});
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const lineasPayload = Object.entries(precios)
      .filter(([, v]) => typeof v === "number" && v >= 0)
      .map(([id, v]) => ({
        recepcionDetalleId: Number(id),
        precioUnitario: v as number,
      }));
    startTransition(async () => {
      const res = await cerrarRecepcionSinFactura({
        recepcionId,
        motivo: motivoTrim,
        lineas: lineasPayload,
      });
      if (res.ok) {
        toast.success(tRec("cerrarSinFactura.toastOk"));
        setOpen(false);
        reset();
        router.refresh();
        return;
      }
      const key =
        res.error === "already_closed"
          ? "toastYaCerrada"
          : res.error === "nothing_to_close"
            ? "toastNadaPorCerrar"
            : res.error === "forbidden"
              ? "toastForbidden"
              : "toastUnknown";
      toast.error(tRec(`cerrarSinFactura.${key}`));
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {tRec("cerrarSinFactura.accion")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tRec("cerrarSinFactura.dialogTitulo")}</DialogTitle>
          <DialogDescription>
            {tRec("cerrarSinFactura.dialogDescripcion")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="motivo-cierre-recepcion">
              {tRec("cerrarSinFactura.motivoLabel")}
            </Label>
            <Textarea
              id="motivo-cierre-recepcion"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={tRec("cerrarSinFactura.motivoPlaceholder")}
              rows={3}
              maxLength={500}
              disabled={pending}
            />
          </div>
          {lineas.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div>
                <Label>{tRec("cerrarSinFactura.preciosTitulo")}</Label>
                <p className="text-xs text-muted-foreground">
                  {tRec("cerrarSinFactura.preciosAyuda")}
                </p>
              </div>
              <ul className="flex flex-col gap-2">
                {lineas.map((ln) => (
                  <li key={ln.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {ln.itemDescripcion || "—"}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {ln.itemCodigo || "—"} · {ln.cantidadRecibida}
                        {ln.unidadMedida ? ` ${ln.unidadMedida}` : ""}
                      </div>
                    </div>
                    <NumberInput
                      value={precios[ln.id] ?? ""}
                      onChange={(v) =>
                        setPrecios((prev) => ({
                          ...prev,
                          [ln.id]: typeof v === "number" ? v : "",
                        }))
                      }
                      min={0}
                      step={0.01}
                      className="h-9 w-32 text-right tabular-nums"
                      aria-label={tRec("cerrarSinFactura.preciosTitulo")}
                      disabled={pending}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            {tCommon("cancelar")}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {pending
              ? tCommon("guardando")
              : tRec("cerrarSinFactura.confirmar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
