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

import { cerrarRecepcionSinFactura } from "../actions";

export function CerrarSinFacturaButton({
  recepcionId,
}: {
  recepcionId: number;
}) {
  const tRec = useTranslations("compras.recepciones");
  const tCommon = useTranslations("listados.common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pending, startTransition] = useTransition();

  const motivoTrim = motivo.trim();
  const canSubmit = !pending && motivoTrim.length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    startTransition(async () => {
      const res = await cerrarRecepcionSinFactura({
        recepcionId,
        motivo: motivoTrim,
      });
      if (res.ok) {
        toast.success(tRec("cerrarSinFactura.toastOk"));
        setOpen(false);
        setMotivo("");
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
        if (!pending) setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {tRec("cerrarSinFactura.accion")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tRec("cerrarSinFactura.dialogTitulo")}</DialogTitle>
          <DialogDescription>
            {tRec("cerrarSinFactura.dialogDescripcion")}
          </DialogDescription>
        </DialogHeader>
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
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            {tCommon("cancelar")}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {pending
              ? tCommon("guardando")
              : tRec("cerrarSinFactura.confirmar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
