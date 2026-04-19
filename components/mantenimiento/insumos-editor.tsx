"use client";

import { Trash2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/app/combobox";

export type InventarioOption = {
  id: number;
  codigo: string | null;
  descripcion: string | null;
  unidadMedida: string | null;
  valorUnitario: number;
  stock: number;
};

export type InsumoLine = {
  id?: number;
  itemInventarioId: number | null;
  cantidadSugerida: number;
  cantidadUtilizada: number;
  unidadMedida: string;
  costoUnitario: number;
};

export function InsumosEditor({
  lines,
  onChange,
  inventario,
  disabled,
  showSugerida = true,
}: {
  lines: InsumoLine[];
  onChange: (lines: InsumoLine[]) => void;
  inventario: InventarioOption[];
  disabled?: boolean;
  showSugerida?: boolean;
}) {
  const t = useTranslations("mantenimiento.insumos");

  const itemById = new Map(inventario.map((i) => [i.id, i]));

  const options = inventario.map((i) => ({
    value: String(i.id),
    label: formatItemLabel(i),
  }));

  const updateLine = (idx: number, patch: Partial<InsumoLine>) => {
    const next = [...lines];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const removeLine = (idx: number) => {
    const next = [...lines];
    next.splice(idx, 1);
    onChange(next);
  };

  const addLine = () => {
    onChange([
      ...lines,
      {
        itemInventarioId: null,
        cantidadSugerida: 0,
        cantidadUtilizada: 0,
        unidadMedida: "",
        costoUnitario: 0,
      },
    ]);
  };

  const handleItemChange = (idx: number, idStr: string) => {
    const id = idStr ? Number(idStr) : null;
    if (id == null) {
      updateLine(idx, {
        itemInventarioId: null,
        unidadMedida: "",
        costoUnitario: 0,
      });
      return;
    }
    const item = itemById.get(id);
    updateLine(idx, {
      itemInventarioId: id,
      unidadMedida: item?.unidadMedida ?? "",
      costoUnitario: item?.valorUnitario ?? 0,
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {lines.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          {t("sinInsumos")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left font-medium">
                  {t("item")}
                </th>
                {showSugerida ? (
                  <th className="px-2 py-2 text-right font-medium w-24">
                    {t("cantidadSugerida")}
                  </th>
                ) : null}
                <th className="px-2 py-2 text-right font-medium w-24">
                  {t("cantidadUtilizada")}
                </th>
                <th className="px-2 py-2 text-right font-medium w-28">
                  {t("costoUnitario")}
                </th>
                <th className="px-2 py-2 text-right font-medium w-28">
                  {t("costoTotal")}
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const item = line.itemInventarioId
                  ? itemById.get(line.itemInventarioId)
                  : null;
                const overConsumption =
                  item && line.cantidadUtilizada > item.stock;
                const costoTotal =
                  line.cantidadUtilizada * line.costoUnitario;
                return (
                  <tr key={idx} className="border-t border-border align-top">
                    <td className="px-2 py-2">
                      <Combobox
                        value={
                          line.itemInventarioId
                            ? String(line.itemInventarioId)
                            : ""
                        }
                        onChange={(v) => handleItemChange(idx, v)}
                        options={options}
                        placeholder={t("item")}
                        allowCreate={false}
                        disabled={disabled}
                        className="h-8"
                      />
                      {overConsumption ? (
                        <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                          {t("sobreConsumoAviso")}
                        </div>
                      ) : null}
                    </td>
                    {showSugerida ? (
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.cantidadSugerida || ""}
                          disabled
                          className="h-8 text-right tabular-nums"
                        />
                      </td>
                    ) : null}
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.cantidadUtilizada || ""}
                        onChange={(e) =>
                          updateLine(idx, {
                            cantidadUtilizada: Number(e.target.value) || 0,
                          })
                        }
                        disabled={disabled}
                        className="h-8 text-right tabular-nums"
                      />
                      {line.unidadMedida ? (
                        <div className="mt-0.5 text-right text-xs text-muted-foreground">
                          {line.unidadMedida}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-right text-xs text-muted-foreground tabular-nums">
                      {formatARS(line.costoUnitario)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatARS(costoTotal)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(idx)}
                        disabled={disabled}
                        className="size-7 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addLine}
          disabled={disabled}
        >
          <Plus className="size-4" />
          {t("agregar")}
        </Button>
      </div>
    </div>
  );
}

function formatItemLabel(i: InventarioOption): string {
  const desc = i.descripcion ?? "—";
  const code = i.codigo ? `[${i.codigo}] ` : "";
  return `${code}${desc}`;
}

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
