"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";

import { Combobox } from "@/components/app/combobox";

export type ItemOption = {
  id: number;
  codigo: string | null;
  descripcion: string | null;
  graficable: boolean;
};

export function ItemPicker({
  current,
  items,
}: {
  current: number | null;
  items: ItemOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const t = useTranslations("estadisticas.precios.picker");

  const options = items.map((i) => ({
    value: String(i.id),
    label:
      i.codigo && i.descripcion
        ? `${i.codigo} — ${i.descripcion}${i.graficable ? "" : ` · ${t("unSoloPrecio")}`}`
        : (i.descripcion ?? i.codigo ?? `#${i.id}`),
  }));

  const onChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("itemId", value);
    else params.delete("itemId");
    start(() => router.push(`?${params.toString()}`));
  };

  return (
    <Combobox
      value={current ? String(current) : ""}
      onChange={onChange}
      options={options}
      placeholder={t("placeholder")}
      searchPlaceholder={t("buscar")}
      allowCreate={false}
      disabled={pending}
      className="w-[320px]"
    />
  );
}
