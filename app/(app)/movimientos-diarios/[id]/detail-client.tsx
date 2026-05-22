"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageHeader } from "@/components/app/page-header";
import { formatARS } from "@/lib/format";

import { devolverHerramienta, eliminarMovimientoDiario } from "../actions";

type LineaData = {
  id: number;
  codigoItem: string | null;
  descripcion: string | null;
  cantidad: number;
  unidadMedida: string | null;
  tipo: string;
  devuelto: boolean;
  fechaDevolucion: string | null;
  monto: number | null;
  justificacion: string | null;
};

type MovimientoData = {
  id: number;
  fecha: string;
  usuario: string | null;
  sector: string | null;
  localidad: string | null;
  observaciones: string | null;
  lineas: LineaData[];
};

export function MovimientoDetailClient({
  data,
  canManage,
}: {
  data: MovimientoData;
  canManage: boolean;
}) {
  const t = useTranslations("movimientosDiarios");
  const router = useRouter();
  const [busy, start] = useTransition();

  const total = data.lineas.reduce((acc, l) => acc + (l.monto ?? 0), 0);

  const onDevolver = (lineaId: number) => {
    start(async () => {
      const res = await devolverHerramienta(lineaId);
      if (res.ok) {
        toast.success(t("avisos.devuelto"));
        router.refresh();
      } else if (res.error === "forbidden") {
        toast.error(t("avisos.sinPermisos"));
      } else {
        toast.error(t("avisos.errorGuardar"));
      }
    });
  };

  const onEliminar = () => {
    start(async () => {
      const res = await eliminarMovimientoDiario(data.id);
      if (res.ok) {
        toast.success(t("avisos.eliminado"));
        router.push("/movimientos-diarios");
      } else if (res.error === "forbidden") {
        toast.error(t("avisos.sinPermisos"));
      } else {
        toast.error(t("avisos.errorGuardar"));
      }
    });
  };

  const kv: Array<{ label: string; value: string | null }> = [
    {
      label: t("campos.fecha"),
      value: format(new Date(data.fecha), "dd/MM/yyyy", { locale: es }),
    },
    { label: t("campos.usuario"), value: data.usuario },
    { label: t("campos.sector"), value: data.sector },
    { label: t("campos.localidad"), value: data.localidad },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/movimientos-diarios">
            <ArrowLeft className="size-4" />
            {t("volver")}
          </Link>
        </Button>
        <PageHeader
          title={t("detalleTitulo", { id: data.id })}
          description={t("detalleAyuda")}
          actions={
            canManage ? (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm">
                    <Trash2 className="size-4" />
                    {t("eliminar")}
                  </Button>
                }
                title={t("eliminarPregunta")}
                description={t("eliminarAviso")}
                confirmLabel={t("eliminar")}
                destructive
                onConfirm={onEliminar}
              />
            ) : null
          }
        />
      </div>

      <Card className="gap-3 p-5">
        <h2 className="text-sm font-semibold">{t("secciones.cabecera")}</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {kv.map((item) => (
            <div key={item.label} className="flex flex-col gap-0.5">
              <dt className="text-[11px] uppercase tracking-wide text-subtle-foreground">
                {item.label}
              </dt>
              <dd className="text-sm font-medium">
                {item.value ?? (
                  <span className="text-subtle-foreground">—</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
        {data.observaciones ? (
          <p className="whitespace-pre-wrap border-t border-border pt-3 text-sm leading-relaxed">
            {data.observaciones}
          </p>
        ) : null}
      </Card>

      <Card className="gap-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{t("secciones.lineas")}</h2>
          <span className="text-xs text-subtle-foreground">
            {t("lineas.total")}{" "}
            <span className="font-mono font-semibold text-foreground">
              {formatARS(total)}
            </span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10.5px] font-semibold uppercase tracking-wide text-subtle-foreground">
                <th className="py-2 pr-2">{t("lineas.item")}</th>
                <th className="py-2 pr-2">{t("lineas.cantidad")}</th>
                <th className="py-2 pr-2">{t("lineas.tipo")}</th>
                <th className="py-2 pr-2">{t("lineas.estado")}</th>
                <th className="py-2 pr-2">{t("lineas.valor")}</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.lineas.map((l) => {
                const esHerramienta = l.tipo === "herramienta";
                return (
                  <tr
                    key={l.id}
                    className="border-b border-dashed border-border align-top last:border-b-0"
                  >
                    <td className="py-2 pr-2">
                      <div className="font-medium">
                        {l.codigoItem
                          ? `${l.codigoItem} — ${l.descripcion ?? ""}`
                          : (l.descripcion ?? "—")}
                      </div>
                      {l.justificacion ? (
                        <div className="text-xs text-subtle-foreground">
                          {l.justificacion}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2 tabular-nums">
                      {l.cantidad} {l.unidadMedida ?? ""}
                    </td>
                    <td className="py-2 pr-2">
                      <Badge variant={esHerramienta ? "secondary" : "default"}>
                        {esHerramienta
                          ? t("tipo.herramienta")
                          : t("tipo.consumible")}
                      </Badge>
                    </td>
                    <td className="py-2 pr-2">
                      {!esHerramienta ? (
                        <span className="text-xs text-subtle-foreground">
                          {t("lineas.consumido")}
                        </span>
                      ) : l.devuelto ? (
                        <span className="text-xs text-sky-600 dark:text-sky-400">
                          {l.fechaDevolucion
                            ? t("lineas.devueltoEl", {
                                fecha: format(
                                  new Date(l.fechaDevolucion),
                                  "dd/MM/yyyy",
                                  { locale: es },
                                ),
                              })
                            : t("lineas.devuelto")}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          {t("lineas.sinDevolver")}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2 font-mono tabular-nums">
                      {formatARS(l.monto ?? 0)}
                    </td>
                    <td className="py-2">
                      {canManage && esHerramienta && !l.devuelto ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDevolver(l.id)}
                          disabled={busy}
                        >
                          <RotateCcw className="size-3.5" />
                          {t("lineas.devolver")}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
