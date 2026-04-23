import { ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";

export default function SinPermisosPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Sin permisos" />
      <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium">
            Tu rol no tiene permisos de lectura asignados.
          </p>
          <p className="mt-1 text-amber-800/80 dark:text-amber-100/80">
            Contactá a un administrador para que te habilite el acceso a los
            módulos que necesitás.
          </p>
        </div>
      </div>
    </div>
  );
}
