"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/app/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  PlantillaForm,
  type InventarioLite,
  type PlantillaFormInitial,
  type TipoMaquinariaOpt,
} from "../plantilla-form";
import { aplicarPlantilla } from "../actions";

type MaquinariaOpt = { id: number; label: string };
type UsuarioOpt = { id: number; nombre: string };
type UpOpt = { id: number; nombre: string; localidad: string | null };

export function PlantillaDetailClient({
  initial,
  tipos,
  inventario,
  maquinarias,
  usuarios,
  unidadesProductivas,
  isAdmin,
}: {
  initial: PlantillaFormInitial;
  tipos: TipoMaquinariaOpt[];
  inventario: InventarioLite[];
  maquinarias: MaquinariaOpt[];
  usuarios: UsuarioOpt[];
  unidadesProductivas: UpOpt[];
  isAdmin: boolean;
}) {
  const tM = useTranslations("mantenimiento");
  const tP = useTranslations("mantenimiento.plantillas");
  const router = useRouter();
  const [pending, start] = useTransition();

  const [open, setOpen] = useState(false);
  const [maquinariaId, setMaquinariaId] = useState<number | null>(null);
  const [responsableId, setResponsableId] = useState<number | null>(null);
  const [unidadProductivaId, setUnidadProductivaId] = useState<number | null>(
    null,
  );
  const [fechaProgramada, setFechaProgramada] = useState("");

  const maquinariaOpts = maquinarias.map((m) => ({
    value: String(m.id),
    label: m.label,
  }));
  const usuarioOpts = usuarios.map((u) => ({
    value: String(u.id),
    label: u.nombre,
  }));
  const upOpts = unidadesProductivas.map((u) => ({
    value: String(u.id),
    label: u.localidad ? `${u.nombre} (${u.localidad})` : u.nombre,
  }));

  const aplicar = () => {
    if (!initial.id || !maquinariaId || !responsableId) return;
    start(async () => {
      const res = await aplicarPlantilla(initial.id as number, {
        maquinariaId,
        responsableId,
        unidadProductivaId,
        fechaProgramada,
      });
      if (!res.ok) {
        if (res.error === "forbidden") {
          toast.error(tM("avisos.sinPermisos"));
        } else {
          toast.error(tM("avisos.errorGenerico"));
        }
        return;
      }
      toast.success(tP("avisos.aplicadaExitosa"));
      setOpen(false);
      router.push(`/mantenimiento/${res.id}`);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end px-6 pt-6">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Play className="size-4" />
              {tP("aplicar")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{tP("aplicar")}</DialogTitle>
              <DialogDescription>{tP("aplicarDescripcion")}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>{tM("campos.maquina")} *</Label>
                <Combobox
                  value={maquinariaId ? String(maquinariaId) : ""}
                  onChange={(v) => setMaquinariaId(v ? Number(v) : null)}
                  options={maquinariaOpts}
                  placeholder={tM("campos.maquina")}
                  allowCreate={false}
                />
                {maquinarias.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {tP("avisos.sinMaquinasDelTipo")}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{tM("campos.responsable")} *</Label>
                <Combobox
                  value={responsableId ? String(responsableId) : ""}
                  onChange={(v) => setResponsableId(v ? Number(v) : null)}
                  options={usuarioOpts}
                  placeholder={tM("campos.responsable")}
                  allowCreate={false}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{tM("campos.unidadProductiva")}</Label>
                <Combobox
                  value={
                    unidadProductivaId ? String(unidadProductivaId) : ""
                  }
                  onChange={(v) =>
                    setUnidadProductivaId(v ? Number(v) : null)
                  }
                  options={[{ value: "", label: "—" }, ...upOpts]}
                  placeholder={tM("campos.unidadProductiva")}
                  allowCreate={false}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{tM("campos.fechaProgramada")}</Label>
                <Input
                  type="date"
                  value={fechaProgramada}
                  onChange={(e) => setFechaProgramada(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                {tM("acciones.cancelarDialogo")}
              </Button>
              <Button
                onClick={aplicar}
                disabled={pending || !maquinariaId || !responsableId}
              >
                {tP("aplicar")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <PlantillaForm
        mode="edit"
        initial={initial}
        tipos={tipos}
        inventario={inventario}
        isAdmin={isAdmin}
      />
    </div>
  );
}
