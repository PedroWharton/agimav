"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { DetailDrawer } from "@/components/app/detail-drawer";
import { EmptyState } from "@/components/app/states";
import { StatusChip } from "@/components/app/status-chip";
import { KVGrid, type KVPair } from "@/components/mantenimiento/detail/kv-grid";
import { cn } from "@/lib/utils";

import { statusChip, EquipIcon } from "./helpers";

export type MaquinariaDetailSection = {
  title: string;
  items: KVPair[];
};

export type MaquinariaDetailData = {
  id: number;
  title: string;
  codigo?: string | null;
  subtitle?: string | null;
  tipoNombre: string;
  estado: string;
  horasAcumuladas: number;
  unidadAbrev?: string | null;
  createdAt?: string | null;
  summary: KVPair[];
  sections: MaquinariaDetailSection[];
};

export function MaquinariaDetailDrawer({
  open,
  onOpenChange,
  data,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: MaquinariaDetailData | null;
  footer?: ReactNode;
}) {
  const t = useTranslations("maquinaria.detalle");
  const tCommon = useTranslations("maquinaria");

  if (!data) {
    return (
      <DetailDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={""}
        width="lg"
      />
    );
  }

  const chip = statusChip(data.estado);

  const title = (
    <span className="flex items-center gap-3">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"
      >
        <EquipIcon tipo={data.tipoNombre} className="size-5" />
      </span>
      <span className="min-w-0 flex-1 truncate">{data.title}</span>
    </span>
  );

  const subtitle = (
    <span className="flex flex-wrap items-center gap-2 text-xs">
      {data.codigo ? (
        <span className="font-mono text-foreground">{data.codigo}</span>
      ) : null}
      {data.subtitle ? <span>· {data.subtitle}</span> : null}
      <span>·</span>
      <StatusChip tone={chip.tone} dot label={chip.label} />
    </span>
  );

  const resumenContent = (
    <div className="flex flex-col gap-5">
      <KVGrid items={data.summary} columns={3} />

      {data.sections.length > 0 ? (
        <div className="flex flex-col gap-4">
          {data.sections.map((s, i) => (
            <section key={`${s.title}-${i}`} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
                {s.title}
              </h3>
              {s.items.length === 0 ? (
                <p className="text-sm text-subtle-foreground">
                  {t("sinDatosSeccion")}
                </p>
              ) : (
                <KVGrid items={s.items} columns={2} />
              )}
            </section>
          ))}
        </div>
      ) : null}

      {data.createdAt ? (
        <p className={cn("text-xs text-subtle-foreground")}>
          {t("altaEl", { fecha: data.createdAt })}
        </p>
      ) : null}
    </div>
  );

  const historialContent = (
    <EmptyState
      variant="empty-tab"
      title={t("historial.titulo")}
      description={t("historial.descripcion")}
    />
  );

  const checklistsContent = (
    <EmptyState
      variant="empty-tab"
      title={t("checklists.titulo")}
      description={t("checklists.descripcion")}
    />
  );

  const documentosContent = (
    <EmptyState
      variant="empty-tab"
      title={t("documentos.titulo")}
      description={t("documentos.descripcion")}
    />
  );

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      subtitle={subtitle}
      width="lg"
      footer={footer}
      tabs={[
        {
          id: "resumen",
          label: tCommon("detalle.tabs.resumen"),
          content: resumenContent,
        },
        {
          id: "historial",
          label: tCommon("detalle.tabs.historial"),
          content: historialContent,
        },
        {
          id: "checklists",
          label: tCommon("detalle.tabs.checklists"),
          content: checklistsContent,
        },
        {
          id: "documentos",
          label: tCommon("detalle.tabs.documentos"),
          content: documentosContent,
        },
      ]}
    />
  );
}
