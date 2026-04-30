"use client";

import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import { PageHeader } from "@/components/app/page-header";

import {
  RecepcionesListClient,
  type RecepcionRow,
  type RecepcionesKpis,
} from "./recepciones-list-client";
import {
  RecepcionesPendientesClient,
  type RecepcionPendienteOc,
} from "./recepciones-pendientes-client";

export type { RecepcionPendienteOc, RecepcionPendienteLinea } from "./recepciones-pendientes-client";

export function RecepcionesPageClient({
  historialRows,
  historialProveedores,
  historialKpis,
  pendientesOcs,
  pendientesProveedores,
  pendientesUsuarios,
  pendientesDefaultRecibidoPor,
}: {
  historialRows: RecepcionRow[];
  historialProveedores: string[];
  historialKpis: RecepcionesKpis;
  pendientesOcs: RecepcionPendienteOc[];
  pendientesProveedores: string[];
  pendientesUsuarios: string[];
  pendientesDefaultRecibidoPor: string;
}) {
  const tRec = useTranslations("compras.recepciones");
  const pendientesCount = pendientesOcs.length;

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title={tRec("titulo")}
        description={tRec("descripcion")}
      />
      <Tabs defaultValue="pendientes" className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="pendientes" className="gap-2">
            {tRec("tabs.pendientes")}
            {pendientesCount > 0 ? (
              <Badge
                variant="secondary"
                className="border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
              >
                {pendientesCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="historial">
            {tRec("tabs.historial")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pendientes" className="mt-0">
          <RecepcionesPendientesClient
            ocs={pendientesOcs}
            proveedores={pendientesProveedores}
            usuarios={pendientesUsuarios}
            defaultRecibidoPor={pendientesDefaultRecibidoPor}
          />
        </TabsContent>
        <TabsContent value="historial" className="mt-0">
          <RecepcionesListClient
            rows={historialRows}
            proveedores={historialProveedores}
            kpis={historialKpis}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
