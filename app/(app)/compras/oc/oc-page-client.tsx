"use client";

import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import { PageHeader } from "@/components/app/page-header";

import { OcListClient, type OcRow } from "./oc-list-client";
import {
  OcPendientesClient,
  type AggregatedItemRow,
  type ProveedorOption,
} from "./oc-pendientes-client";

export function OcPageClient({
  emitidasRows,
  emitidasProveedores,
  pendientes,
  proveedorOptions,
}: {
  emitidasRows: OcRow[];
  emitidasProveedores: string[];
  pendientes: AggregatedItemRow[];
  proveedorOptions: ProveedorOption[];
}) {
  const tOc = useTranslations("compras.oc");
  const pendientesCount = pendientes.length;

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title={tOc("titulo")}
        description={tOc("descripcion")}
      />
      <Tabs defaultValue="pendientes" className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="pendientes" className="gap-2">
            {tOc("tabs.pendientes")}
            {pendientesCount > 0 ? (
              <Badge
                variant="secondary"
                className="border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
              >
                {pendientesCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="emitidas">
            {tOc("tabs.emitidas")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pendientes" className="mt-0">
          <OcPendientesClient
            rows={pendientes}
            proveedorOptions={proveedorOptions}
          />
        </TabsContent>
        <TabsContent value="emitidas" className="mt-0">
          <OcListClient
            rows={emitidasRows}
            proveedores={emitidasProveedores}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
