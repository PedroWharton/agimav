"use client";

import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import { PageHeader } from "@/components/app/page-header";

import {
  FacturasListClient,
  type FacturaRow,
  type FacturasKpis,
} from "./facturas-list-client";
import {
  FacturasPendientesClient,
  type FacturaPendienteOc,
} from "./facturas-pendientes-client";

export type { FacturaPendienteOc } from "./facturas-pendientes-client";

export function FacturasPageClient({
  historialRows,
  historialProveedores,
  historialKpis,
  pendientesOcs,
  pendientesProveedores,
}: {
  historialRows: FacturaRow[];
  historialProveedores: string[];
  historialKpis: FacturasKpis;
  pendientesOcs: FacturaPendienteOc[];
  pendientesProveedores: string[];
}) {
  const tFac = useTranslations("compras.facturas");
  const pendientesCount = pendientesOcs.length;

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title={tFac("titulo")}
        description={tFac("descripcion")}
      />
      <Tabs defaultValue="pendientes" className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="pendientes" className="gap-2">
            {tFac("tabs.pendientes")}
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
            {tFac("tabs.historial")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pendientes" className="mt-0">
          <FacturasPendientesClient
            ocs={pendientesOcs}
            proveedores={pendientesProveedores}
          />
        </TabsContent>
        <TabsContent value="historial" className="mt-0">
          <FacturasListClient
            rows={historialRows}
            proveedores={historialProveedores}
            kpis={historialKpis}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
