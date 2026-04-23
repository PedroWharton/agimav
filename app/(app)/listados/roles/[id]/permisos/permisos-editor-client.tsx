"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/app/page-header";

import { ADMIN_ALL } from "@/lib/permisos/catalog";

import { updateRolPermisos } from "./actions";

export type PermisoGroup = {
  modulo: string;
  label: string;
  items: Array<{
    codigo: string;
    descripcion: string;
    selected: boolean;
  }>;
};

export function PermisosEditorClient({
  rol,
  groups,
  locked,
  canEdit,
}: {
  rol: { id: number; nombre: string; usuariosCount: number };
  groups: PermisoGroup[];
  locked: boolean;
  canEdit: boolean;
}) {
  const initial = useMemo(() => {
    const s = new Set<string>();
    for (const g of groups) {
      for (const i of g.items) {
        if (i.selected) s.add(i.codigo);
      }
    }
    return s;
  }, [groups]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial));
  const [isSaving, startSave] = useTransition();

  const dirty = useMemo(() => {
    if (selected.size !== initial.size) return true;
    for (const c of selected) if (!initial.has(c)) return true;
    return false;
  }, [selected, initial]);

  const readOnly = locked || !canEdit;

  function toggle(codigo: string, checked: boolean) {
    if (readOnly) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(codigo);
      else next.delete(codigo);
      return next;
    });
  }

  function toggleGroup(group: PermisoGroup, checked: boolean) {
    if (readOnly) return;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of group.items) {
        if (checked) next.add(i.codigo);
        else next.delete(i.codigo);
      }
      return next;
    });
  }

  function reset() {
    setSelected(new Set(initial));
  }

  function save() {
    startSave(async () => {
      const result = await updateRolPermisos({
        rolId: rol.id,
        codigos: Array.from(selected),
      });
      if (result.ok) {
        toast.success(
          "Permisos actualizados. Los usuarios verán los cambios en su próximo login.",
        );
      } else if (result.error === "forbidden") {
        toast.error("No tenés permisos para esta acción.");
      } else if (result.error === "admin_locked") {
        toast.error("El rol Administrador no se puede editar.");
      } else if (result.error === "last_admin_guarded") {
        toast.error(
          "No se puede quitar el acceso total — quedarías sin administradores activos.",
        );
      } else if (result.error === "unknown_codigo") {
        toast.error("Permiso desconocido. Recargá la página e intentá de nuevo.");
      } else if (result.error === "permisos_not_seeded") {
        toast.error(
          "El catálogo de permisos no está cargado en la base de datos. Ejecutá 'npm run db:seed' y volvé a intentar.",
        );
      } else {
        toast.error("No se pudieron guardar los permisos.");
      }
    });
  }

  const totalCount = useMemo(
    () => groups.reduce((acc, g) => acc + g.items.length, 0),
    [groups],
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={`Permisos — ${rol.nombre}`}
        description={
          <>
            {selected.size}/{totalCount} permisos activos · {rol.usuariosCount}{" "}
            {rol.usuariosCount === 1 ? "usuario" : "usuarios"} con este rol
            {dirty ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                Cambios sin guardar
              </span>
            ) : null}
          </>
        }
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/listados/roles">
              <ArrowLeft className="size-4" />
              Volver
            </Link>
          </Button>
        }
      />

      {locked ? (
        <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">El rol Administrador siempre tiene todos los permisos.</p>
            <p className="text-amber-800/80 dark:text-amber-100/80">
              No es editable — garantiza que siempre haya un acceso total al sistema.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {groups.map((g) => {
          const groupSelected = g.items.filter((i) => selected.has(i.codigo)).length;
          const groupTotal = g.items.length;
          const allChecked = groupSelected === groupTotal;
          return (
            <Card key={g.modulo} className="flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="text-base">{g.label}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {groupSelected}/{groupTotal} seleccionados
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleGroup(g, !allChecked)}
                  disabled={readOnly}
                  className="text-xs font-medium text-sky-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-400"
                >
                  {allChecked ? "Limpiar" : "Seleccionar todos"}
                </button>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {g.items.map((item) => {
                  const isAdminAll = item.codigo === ADMIN_ALL;
                  const checked = selected.has(item.codigo);
                  return (
                    <label
                      key={item.codigo}
                      className="flex cursor-pointer items-start gap-3 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggle(item.codigo, v === true)}
                        disabled={readOnly}
                        className="mt-0.5"
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="leading-tight">{item.descripcion}</span>
                        <code className="text-[11px] text-muted-foreground">
                          {item.codigo}
                        </code>
                        {isAdminAll && !locked ? (
                          <span className="text-[11px] text-amber-700 dark:text-amber-400">
                            Otorga acceso total — usar con cuidado.
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!readOnly ? (
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-background/80 py-3 backdrop-blur">
          <Button variant="ghost" onClick={reset} disabled={!dirty || isSaving}>
            Cancelar cambios
          </Button>
          <Button onClick={save} disabled={!dirty || isSaving}>
            {isSaving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
