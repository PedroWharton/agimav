"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, Info, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/app/page-header";

import { updateUsuarioUnidades } from "./actions";

export type UpItem = {
  id: number;
  nombre: string;
  localidad: string | null;
  selected: boolean;
};

type Grupo = { localidad: string; items: UpItem[] };

export function UnidadesEditorClient({
  usuario,
  items,
}: {
  usuario: { id: number; nombre: string; esAdmin: boolean };
  items: UpItem[];
}) {
  const initial = useMemo(() => {
    const s = new Set<number>();
    for (const i of items) if (i.selected) s.add(i.id);
    return s;
  }, [items]);

  const [selected, setSelected] = useState<Set<number>>(() => new Set(initial));
  const [isSaving, startSave] = useTransition();

  const dirty = useMemo(() => {
    if (selected.size !== initial.size) return true;
    for (const id of selected) if (!initial.has(id)) return true;
    return false;
  }, [selected, initial]);

  const readOnly = usuario.esAdmin;

  const grupos = useMemo<Grupo[]>(() => {
    const map = new Map<string, UpItem[]>();
    for (const it of items) {
      const key = it.localidad?.trim() || "Sin localidad";
      const arr = map.get(key);
      if (arr) arr.push(it);
      else map.set(key, [it]);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "es"))
      .map(([localidad, its]) => ({
        localidad,
        items: its.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      }));
  }, [items]);

  function toggle(id: number, checked: boolean) {
    if (readOnly) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleGroup(group: Grupo, checked: boolean) {
    if (readOnly) return;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of group.items) {
        if (checked) next.add(i.id);
        else next.delete(i.id);
      }
      return next;
    });
  }

  function reset() {
    setSelected(new Set(initial));
  }

  function save() {
    startSave(async () => {
      const result = await updateUsuarioUnidades({
        usuarioId: usuario.id,
        unidadProductivaIds: Array.from(selected),
      });
      if (result.ok) {
        toast.success("Unidades productivas actualizadas.");
      } else if (result.error === "forbidden") {
        toast.error("No tenés permisos para esta acción.");
      } else if (result.error === "not_found") {
        toast.error("El usuario ya no existe. Recargá la página.");
      } else {
        toast.error("No se pudieron guardar los cambios.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={`Unidades productivas — ${usuario.nombre}`}
        description={
          <>
            {selected.size}/{items.length} unidades asignadas
            {dirty ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                Cambios sin guardar
              </span>
            ) : null}
          </>
        }
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/listados/usuarios">
              <ArrowLeft className="size-4" />
              Volver
            </Link>
          </Button>
        }
      />

      {usuario.esAdmin ? (
        <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">
              Este usuario tiene acceso total al sistema.
            </p>
            <p className="text-amber-800/80 dark:text-amber-100/80">
              El filtro por unidad productiva no se le aplica — un administrador
              ve siempre todos los mantenimientos y órdenes de trabajo.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-md border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-900 dark:text-sky-100">
          <Info className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">
              Sin unidades asignadas, el usuario ve todo.
            </p>
            <p className="text-sky-800/80 dark:text-sky-100/80">
              Asigná una o más unidades para acotar qué mantenimientos y órdenes
              de trabajo puede ver. Si no asignás ninguna, sigue viendo todo.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {grupos.map((g) => {
          const groupSelected = g.items.filter((i) =>
            selected.has(i.id),
          ).length;
          const groupTotal = g.items.length;
          const allChecked = groupSelected === groupTotal;
          return (
            <Card key={g.localidad} className="flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="text-base">{g.localidad}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {groupSelected}/{groupTotal} seleccionadas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleGroup(g, !allChecked)}
                  disabled={readOnly}
                  className="text-xs font-medium text-sky-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-400"
                >
                  {allChecked ? "Limpiar" : "Seleccionar todas"}
                </button>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {g.items.map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-start gap-3 text-sm"
                  >
                    <Checkbox
                      checked={selected.has(item.id)}
                      onCheckedChange={(v) => toggle(item.id, v === true)}
                      disabled={readOnly}
                      className="mt-0.5"
                    />
                    <span className="leading-tight">{item.nombre}</span>
                  </label>
                ))}
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
