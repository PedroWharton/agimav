"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type FormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  isDirty: boolean;
  isSubmitting: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: () => void;
  children: ReactNode;
};

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  isDirty,
  isSubmitting,
  submitLabel,
  cancelLabel,
  onSubmit,
  children,
}: FormDialogProps) {
  const t = useTranslations("listados.common");
  const [discardOpen, setDiscardOpen] = useState(false);

  const attemptClose = (next: boolean) => {
    if (!next && isDirty) {
      setDiscardOpen(true);
      return;
    }
    onOpenChange(next);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={attemptClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
            className="grid gap-4"
          >
            <div className="grid gap-4">{children}</div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => attemptClose(false)}
                disabled={isSubmitting}
              >
                {cancelLabel ?? t("cancelar")}
              </Button>
              <Button type="submit" disabled={!isDirty || isSubmitting}>
                {isSubmitting ? t("guardando") : (submitLabel ?? t("guardar"))}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("descartarCambios")}</AlertDialogTitle>
            <AlertDialogDescription>
              Los cambios que no hayas guardado se van a perder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDiscardOpen(false);
                onOpenChange(false);
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
