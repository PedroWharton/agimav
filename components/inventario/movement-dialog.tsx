"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { CurrencyInput } from "@/components/app/currency-input";
import { StockBadge } from "@/components/inventario/stock-badge";
import { formatARS, formatNumber } from "@/lib/format";

import { registerMovimiento } from "@/app/(app)/inventario/actions";

type Tipo = "entrada" | "salida" | "ajuste_precio";

export type MovementDialogTarget = {
  id: number;
  codigo: string;
  descripcion: string;
  stock: number;
  stockMinimo: number;
  valorUnitario: number;
  unidadMedida: string | null;
};

const formSchema = z.object({
  tipo: z.enum(["entrada", "salida", "ajuste_precio"]),
  cantidad: z.number().nonnegative(),
  valorUnitario: z.number().nonnegative(),
  motivo: z.string().trim().min(1, "Obligatorio").max(200),
  observaciones: z.string().trim().max(500).optional(),
});
type FormValues = z.infer<typeof formSchema>;

export function MovementDialog({
  target,
  open,
  onOpenChange,
  onSuccess,
}: {
  target: MovementDialogTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const t = useTranslations("inventario.movimientos");
  const [isSubmitting, startSubmit] = useTransition();
  const [negativeConfirmed, setNegativeConfirmed] = useState(false);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: {
      tipo: "entrada",
      cantidad: 0,
      valorUnitario: target?.valorUnitario ?? 0,
      motivo: "",
      observaciones: "",
    },
  });

  const tipo = form.watch("tipo") as Tipo;
  const cantidad = form.watch("cantidad") ?? 0;
  const valorUnitario = form.watch("valorUnitario") ?? 0;

  useEffect(() => {
    if (open && target) {
      form.reset({
        tipo: "entrada",
        cantidad: 0,
        valorUnitario: target.valorUnitario ?? 0,
        motivo: "",
        observaciones: "",
      });
      setNegativeConfirmed(false);
    }
  }, [open, target, form]);

  useEffect(() => {
    setNegativeConfirmed(false);
  }, [tipo, cantidad]);

  const stockResultante = useMemo(() => {
    if (!target) return 0;
    if (tipo === "entrada") return target.stock + cantidad;
    if (tipo === "salida") return target.stock - cantidad;
    return target.stock;
  }, [target, tipo, cantidad]);

  const driveNegative = tipo === "salida" && stockResultante < 0 && cantidad > 0;
  const needsConfirmNegative = driveNegative && !negativeConfirmed;

  function submit() {
    if (!target) return;
    form.handleSubmit((values) => {
      startSubmit(async () => {
        let payload: unknown;
        if (values.tipo === "entrada") {
          payload = {
            tipo: "entrada",
            cantidad: values.cantidad,
            valorUnitario: values.valorUnitario,
            motivo: values.motivo,
            observaciones: values.observaciones,
          };
        } else if (values.tipo === "salida") {
          payload = {
            tipo: "salida",
            cantidad: values.cantidad,
            motivo: values.motivo,
            observaciones: values.observaciones,
          };
        } else {
          payload = {
            tipo: "ajuste_precio",
            valorUnitario: values.valorUnitario,
            motivo: values.motivo,
            observaciones: values.observaciones,
          };
        }
        const result = await registerMovimiento(target.id, payload);
        if (result.ok) {
          toast.success(t("registrado"));
          onOpenChange(false);
          onSuccess?.();
        } else if (result.error === "invalid" && result.fieldErrors) {
          for (const [k, msg] of Object.entries(result.fieldErrors)) {
            if (k in values) {
              form.setError(k as keyof FormValues, { message: msg });
            } else {
              toast.error(msg);
            }
          }
        } else if (result.error === "forbidden") {
          toast.error("No tenés permisos para esta acción.");
        } else if (result.error === "not_found") {
          toast.error("El item ya no existe.");
        } else {
          toast.error("No se pudo registrar. Reintentá en unos segundos.");
        }
      });
    })();
  }

  if (!target) return null;

  const totalEntrada = tipo === "entrada" ? cantidad * valorUnitario : 0;
  const unit = target.unidadMedida ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("registrar")} — {target.descripcion}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono">{target.codigo}</span>
            <span>·</span>
            <span>{t("avisos.stockActual", { stock: formatNumber(target.stock) })}{unit ? ` ${unit}` : ""}</span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (needsConfirmNegative) {
                setNegativeConfirmed(true);
                return;
              }
              submit();
            }}
            className="grid gap-4"
          >
            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("campos.tipo")}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid grid-cols-3 gap-2"
                    >
                      <TipoOption
                        value="entrada"
                        label={t("tipos.entrada")}
                        selected={field.value === "entrada"}
                      />
                      <TipoOption
                        value="salida"
                        label={t("tipos.salida")}
                        selected={field.value === "salida"}
                      />
                      <TipoOption
                        value="ajuste_precio"
                        label={t("tipos.ajustePrecio")}
                        selected={field.value === "ajuste_precio"}
                      />
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {tipo !== "ajuste_precio" ? (
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="cantidad"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("campos.cantidad")} *
                        {unit ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({unit})
                          </span>
                        ) : null}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min={0}
                          className="tabular-nums"
                          value={field.value}
                          onChange={(e) => {
                            const raw = e.target.value;
                            field.onChange(raw === "" ? 0 : Number(raw));
                          }}
                          autoFocus
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {tipo === "entrada" ? (
                  <FormField
                    control={form.control}
                    name="valorUnitario"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("campos.valorUnitario")} *</FormLabel>
                        <FormControl>
                          <CurrencyInput
                            value={field.value}
                            onChange={(v) => field.onChange(v === "" ? 0 : v)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <div className="flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground">
                      {t("campos.valorUnitario")}
                    </span>
                    <span className="h-9 flex items-center tabular-nums">
                      {formatARS(target.valorUnitario)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <FormField
                control={form.control}
                name="valorUnitario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("campos.nuevoValor")} *</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value}
                        onChange={(v) => field.onChange(v === "" ? 0 : v)}
                        autoFocus
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {tipo === "entrada" ? (
              <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  {t("campos.total")}
                </span>
                <span className="tabular-nums font-medium">
                  {formatARS(totalEntrada)}
                </span>
              </div>
            ) : null}

            {tipo !== "ajuste_precio" ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("avisos.stockResultante", {
                    stock: formatNumber(stockResultante),
                  })}
                </span>
                <StockBadge
                  stock={stockResultante}
                  stockMinimo={target.stockMinimo}
                  unidad={target.unidadMedida}
                />
              </div>
            ) : null}

            <FormField
              control={form.control}
              name="motivo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("campos.motivo")} *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observaciones"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("campos.observaciones")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={2}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {driveNegative ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {t("avisos.negativoConfirmar", {
                  stock: formatNumber(stockResultante),
                })}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Registrando…"
                  : needsConfirmNegative
                    ? "Confirmar"
                    : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function TipoOption({
  value,
  label,
  selected,
}: {
  value: string;
  label: string;
  selected: boolean;
}) {
  return (
    <Label
      htmlFor={`tipo-${value}`}
      className={
        selected
          ? "flex cursor-pointer items-center gap-2 rounded-md border border-primary bg-primary/5 px-3 py-2 text-sm"
          : "flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:border-border/70"
      }
    >
      <RadioGroupItem id={`tipo-${value}`} value={value} />
      <span>{label}</span>
    </Label>
  );
}
