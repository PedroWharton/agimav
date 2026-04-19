"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { downloadBase64 } from "@/lib/download";

import { exportarProveedores } from "./actions";
import type { ProvRange } from "./types";

export function ProveedoresExportButton({ range }: { range: ProvRange }) {
  const t = useTranslations("estadisticas");
  const [pending, start] = useTransition();

  const run = () => {
    start(async () => {
      try {
        const { base64, filename } = await exportarProveedores(range);
        downloadBase64(base64, filename);
      } catch {
        toast.error(t("exportarError"));
      }
    });
  };

  return (
    <Button variant="outline" onClick={run} disabled={pending}>
      <Download className="size-4" />
      {t("exportar")}
    </Button>
  );
}
