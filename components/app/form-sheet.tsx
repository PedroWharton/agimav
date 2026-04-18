"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

export type FormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  isDirty: boolean;
  isSubmitting: boolean;
  readOnly?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit?: () => void;
  children: ReactNode;
};

export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  isDirty,
  isSubmitting,
  readOnly,
  submitLabel,
  cancelLabel,
  onSubmit,
  children,
}: FormSheetProps) {
  const t = useTranslations("listados.common");
  const [discardOpen, setDiscardOpen] = useState(false);

  const attemptClose = (next: boolean) => {
    if (!next && isDirty && !readOnly) {
      setDiscardOpen(true);
      return;
    }
    onOpenChange(next);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={attemptClose}>
        <SheetContent className="sm:max-w-lg flex flex-col">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (readOnly) return;
              onSubmit?.();
            }}
            className="flex flex-1 flex-col min-h-0"
          >
            <div className="flex-1 overflow-y-auto px-4 py-2">
              <div className="grid gap-4">{children}</div>
            </div>
            {!readOnly ? (
              <SheetFooter className="border-t border-border">
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
              </SheetFooter>
            ) : null}
          </form>
        </SheetContent>
      </Sheet>
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
