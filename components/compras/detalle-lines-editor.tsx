"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Trash2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox, type ComboboxOption } from "@/components/app/combobox";
import { cn } from "@/lib/utils";

export type InventarioOption = {
  id: number;
  codigo: string;
  descripcion: string;
  unidadMedida: string | null;
};

export type DetalleLine = {
  key: string;
  id?: number;
  itemId: number | null;
  cantidad: number | null;
  prioridadItem: "Normal" | "Urgente";
  notasItem: string;
};

export function emptyLine(): DetalleLine {
  return {
    key: cryptoRandomKey(),
    itemId: null,
    cantidad: null,
    prioridadItem: "Normal",
    notasItem: "",
  };
}

function cryptoRandomKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `k-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export function DetalleLinesEditor({
  lines,
  onChange,
  inventarioOptions,
  readOnly,
}: {
  lines: DetalleLine[];
  onChange: (next: DetalleLine[]) => void;
  inventarioOptions: InventarioOption[];
  readOnly?: boolean;
}) {
  const t = useTranslations("compras.requisiciones.lineas");
  const tPrior = useTranslations("compras.common.prioridades");

  const comboOptions = useMemo<ComboboxOption[]>(
    () =>
      inventarioOptions.map((opt) => ({
        value: String(opt.id),
        label: opt.codigo
          ? `${opt.codigo} · ${opt.descripcion}`
          : opt.descripcion,
      })),
    [inventarioOptions],
  );

  const itemById = useMemo(() => {
    const m = new Map<number, InventarioOption>();
    for (const opt of inventarioOptions) m.set(opt.id, opt);
    return m;
  }, [inventarioOptions]);

  const usedItemIds = useMemo(() => {
    const s = new Set<number>();
    for (const ln of lines) if (ln.itemId != null) s.add(ln.itemId);
    return s;
  }, [lines]);

  function updateLine(key: string, patch: Partial<DetalleLine>) {
    onChange(lines.map((ln) => (ln.key === key ? { ...ln, ...patch } : ln)));
  }

  function removeLine(key: string) {
    onChange(lines.filter((ln) => ln.key !== key));
  }

  function addLine() {
    onChange([...lines, emptyLine()]);
  }

  if (readOnly) {
    return (
      <ul className="divide-y divide-border rounded-md border border-border">
        {lines.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">{t("sinLineas")}</li>
        ) : (
          lines.map((ln, idx) => {
            const item = ln.itemId ? itemById.get(ln.itemId) : null;
            return (
              <li
                key={ln.key}
                className="flex items-start gap-3 px-3 py-2 text-sm"
              >
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {item
                      ? `${item.codigo || "—"} · ${item.descripcion}`
                      : "—"}
                  </div>
                  {ln.notasItem ? (
                    <div className="text-xs text-muted-foreground truncate">
                      {ln.notasItem}
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <div className="tabular-nums">
                    {ln.cantidad ?? 0}
                    {item?.unidadMedida ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        {item.unidadMedida}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {ln.prioridadItem}
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left font-medium w-10">#</th>
              <th className="px-2 py-2 text-left font-medium">{t("item")}</th>
              <th className="px-2 py-2 text-right font-medium w-28">
                {t("cantidad")}
              </th>
              <th className="px-2 py-2 text-left font-medium w-16">
                {t("unidad")}
              </th>
              <th className="px-2 py-2 text-left font-medium w-28">
                {t("prioridad")}
              </th>
              <th className="px-2 py-2 text-left font-medium">{t("notas")}</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  {t("sinLineas")}
                </td>
              </tr>
            ) : (
              lines.map((ln, idx) => {
                const item = ln.itemId ? itemById.get(ln.itemId) : null;
                const duplicate =
                  ln.itemId != null &&
                  lines.filter((l) => l.itemId === ln.itemId).length > 1;
                return (
                  <tr key={ln.key} className="border-t border-border">
                    <td className="px-2 py-2 align-top text-xs text-muted-foreground tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Combobox
                        value={ln.itemId ? String(ln.itemId) : ""}
                        onChange={(v) =>
                          updateLine(ln.key, {
                            itemId: v ? Number(v) : null,
                          })
                        }
                        options={comboOptions.filter(
                          (opt) =>
                            !usedItemIds.has(Number(opt.value)) ||
                            opt.value === String(ln.itemId),
                        )}
                        placeholder={t("itemPlaceholder")}
                        allowCreate={false}
                        className={cn(
                          "h-9",
                          duplicate ? "border-destructive" : "",
                        )}
                      />
                      {duplicate ? (
                        <p className="mt-1 text-xs text-destructive">
                          {t("duplicada")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 align-top text-right">
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min={0}
                        className="h-9 tabular-nums text-right"
                        value={ln.cantidad ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          updateLine(ln.key, {
                            cantidad: raw === "" ? null : Number(raw),
                          });
                        }}
                      />
                    </td>
                    <td className="px-2 py-2 align-top text-xs text-muted-foreground">
                      {item?.unidadMedida ?? "—"}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Select
                        value={ln.prioridadItem}
                        onValueChange={(v) =>
                          updateLine(ln.key, {
                            prioridadItem: v as DetalleLine["prioridadItem"],
                          })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Normal">
                            {tPrior("Normal")}
                          </SelectItem>
                          <SelectItem value="Urgente">
                            {tPrior("Urgente")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input
                        className="h-9"
                        value={ln.notasItem}
                        onChange={(e) =>
                          updateLine(ln.key, { notasItem: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2 py-2 align-top text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("eliminar")}
                        onClick={() => removeLine(ln.key)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div>
        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          <Plus className="size-4" />
          {t("agregar")}
        </Button>
      </div>
    </div>
  );
}
