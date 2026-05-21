"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

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
import { Combobox } from "@/components/app/combobox";

import { actualizarRecibidoPor } from "../actions";

export function EditarRecibidoPorButton({
  recepcionId,
  recibidoPorActual,
  usuarios,
}: {
  recepcionId: number;
  recibidoPorActual: string;
  usuarios: string[];
}) {
  const tRec = useTranslations("compras.recepciones");
  const tCommon = useTranslations("listados.common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState(recibidoPorActual);
  const [pending, startTransition] = useTransition();

  const valorTrim = valor.trim();
  const canSubmit = !pending && valorTrim.length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    startTransition(async () => {
      const res = await actualizarRecibidoPor({
        recepcionId,
        recibidoPor: valorTrim,
      });
      if (res.ok) {
        toast.success(tRec("recibidoPor.toastOk"));
        setOpen(false);
        router.refresh();
        return;
      }
      toast.error(
        res.error === "forbidden"
          ? tCommon("errorForbidden")
          : tCommon("errorGuardar"),
      );
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (next) setValor(recibidoPorActual);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={tRec("recibidoPor.editar")}
        >
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tRec("recibidoPor.editar")}</DialogTitle>
          <DialogDescription>
            {tRec("recibidoPor.descripcion")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label>{tRec("campos.recibidoPor")}</Label>
          <Combobox
            value={valor}
            onChange={setValor}
            options={usuarios.map((u) => ({ value: u, label: u }))}
            allowCreate={false}
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
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {pending ? tCommon("guardando") : tCommon("guardar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
