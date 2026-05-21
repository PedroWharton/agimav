"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PackagePlus } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createItem } from "@/app/(app)/inventario/actions";
import type { InventarioOption } from "./detalle-lines-editor";

/**
 * Quick-create dialog for a new Inventario item, used from the requisición line
 * editor so a requester can register an item that doesn't exist yet without
 * leaving the form. Reuses the inventario `createItem` action; the new item is
 * persisted to inventory and handed back to the caller via {@link onCreated}.
 */
export function CrearItemDialog({
  onCreated,
}: {
  onCreated: (item: InventarioOption) => void;
}) {
  const t = useTranslations("compras.solicitudes.lineas.crearItem");
  const tCommon = useTranslations("listados.common");
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [unidadMedida, setUnidadMedida] = useState("");
  const [categoria, setCategoria] = useState("");
  const [codigoError, setCodigoError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setCodigo("");
    setDescripcion("");
    setUnidadMedida("");
    setCategoria("");
    setCodigoError(null);
  }

  const canSubmit =
    !pending && codigo.trim().length > 0 && descripcion.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    setCodigoError(null);
    startTransition(async () => {
      const res = await createItem({
        codigo: codigo.trim(),
        descripcion: descripcion.trim(),
        unidadMedida: unidadMedida.trim() || undefined,
        categoria: categoria.trim() || undefined,
      });
      if (res.ok) {
        if (res.id != null) {
          onCreated({
            id: res.id,
            codigo: codigo.trim(),
            descripcion: descripcion.trim(),
            unidadMedida: unidadMedida.trim() || null,
          });
        }
        toast.success(t("toastOk"));
        setOpen(false);
        reset();
        return;
      }
      if (res.error === "duplicate_codigo") {
        setCodigoError(t("duplicado"));
      } else if (res.error === "invalid") {
        setCodigoError(t("invalido"));
      } else if (res.error === "forbidden") {
        toast.error(tCommon("errorForbidden"));
      } else {
        toast.error(tCommon("errorGuardar"));
      }
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
        <Button type="button" variant="outline" size="sm">
          <PackagePlus className="size-4" />
          {t("accion")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("titulo")}</DialogTitle>
          <DialogDescription>{t("descripcion")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="crear-item-codigo">{t("codigo")} *</Label>
            <Input
              id="crear-item-codigo"
              value={codigo}
              onChange={(e) => {
                setCodigo(e.target.value);
                if (codigoError) setCodigoError(null);
              }}
              disabled={pending}
              aria-invalid={codigoError ? true : undefined}
            />
            {codigoError ? (
              <p className="text-xs text-destructive">{codigoError}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="crear-item-descripcion">
              {t("descripcionItem")} *
            </Label>
            <Input
              id="crear-item-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crear-item-unidad">{t("unidadMedida")}</Label>
              <Input
                id="crear-item-unidad"
                value={unidadMedida}
                onChange={(e) => setUnidadMedida(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crear-item-categoria">{t("categoria")}</Label>
              <Input
                id="crear-item-categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>
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
            {pending ? tCommon("guardando") : t("crear")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
