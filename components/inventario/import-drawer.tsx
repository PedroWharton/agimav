"use client";

import { useRef, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { UploadCloud, FileSpreadsheet, ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { matchHeader } from "@/lib/xlsx-headers";
import {
  previewImportInventario,
  commitImportInventario,
  type ImportRow,
  type ImportPreview,
  type ImportPreviewRow,
} from "@/app/(app)/inventario/actions";

type Step = "archivo" | "vista_previa" | "resultado";

const MAX_SIZE_BYTES = 2 * 1024 * 1024;

export function ImportDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useTranslations("inventario.importar");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("archivo");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [ignorarInvalidos, setIgnorarInvalidos] = useState(false);
  const [result, setResult] = useState<{
    aplicados: number;
    ignorados: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setStep("archivo");
    setFileName(null);
    setParsedRows([]);
    setPreview(null);
    setIgnorarInvalidos(false);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function handleFileSelected(file: File) {
    if (file.size > MAX_SIZE_BYTES) {
      toast.error(t("errorTamaño"));
      return;
    }
    setFileName(file.name);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) {
        toast.error(t("errorArchivoVacio"));
        return;
      }
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: true,
        defval: null,
      });
      if (aoa.length < 2) {
        toast.error(t("errorArchivoVacio"));
        return;
      }
      const headerRow = (aoa[0] as unknown[]).map((h) => String(h ?? "").trim());
      const colIndex: Partial<Record<keyof ImportRow, number>> = {};
      headerRow.forEach((h, i) => {
        const key = matchHeader(h);
        if (key) colIndex[key] = i;
      });
      if (colIndex.codigo === undefined || colIndex.descripcion === undefined) {
        toast.error(t("errorColumnasRequeridas"));
        return;
      }

      const rows: ImportRow[] = aoa.slice(1).map((r) => {
        const arr = r as unknown[];
        const cell = (k: keyof ImportRow) => {
          const idx = colIndex[k];
          return idx === undefined ? null : (arr[idx] ?? null);
        };
        return {
          codigo: cell("codigo") as string | null,
          descripcion: cell("descripcion") as string | null,
          categoria: cell("categoria") as string | null,
          localidad: cell("localidad") as string | null,
          unidadProductiva: cell("unidadProductiva") as string | null,
          unidadMedida: cell("unidadMedida") as string | null,
          stockMinimo: cell("stockMinimo") as string | number | null,
          valorUnitario: cell("valorUnitario") as string | number | null,
        };
      });

      const meaningful = rows.filter(
        (r) =>
          trimIfStr(r.codigo) ||
          trimIfStr(r.descripcion) ||
          r.stockMinimo !== null ||
          r.valorUnitario !== null,
      );

      if (meaningful.length === 0) {
        toast.error(t("errorArchivoVacio"));
        return;
      }

      setParsedRows(meaningful);
      startTransition(async () => {
        const res = await previewImportInventario(meaningful);
        if ("error" in res) {
          toast.error(mapError(res.error, t));
          return;
        }
        setPreview(res);
        setStep("vista_previa");
      });
    } catch (err) {
      console.error(err);
      toast.error(t("errorParseo"));
    }
  }

  function handleCommit() {
    startTransition(async () => {
      const res = await commitImportInventario(parsedRows, {
        ignorarInvalidos,
      });
      if (!res.ok) {
        toast.error(mapError(res.error, t));
        return;
      }
      setResult({ aplicados: res.aplicados, ignorados: res.ignorados });
      setStep("resultado");
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 sm:max-w-3xl p-0">
        <SheetHeader className="border-b border-border p-6">
          <SheetTitle>{t("titulo")}</SheetTitle>
          <SheetDescription>{t("descripcion")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {step === "archivo" ? (
            <StepArchivo
              fileName={fileName}
              onPick={() => fileInputRef.current?.click()}
              fileInputRef={fileInputRef}
              onFile={handleFileSelected}
              disabled={isPending}
            />
          ) : null}
          {step === "vista_previa" && preview ? (
            <StepVistaPrevia
              preview={preview}
              ignorarInvalidos={ignorarInvalidos}
              onToggleIgnorar={setIgnorarInvalidos}
            />
          ) : null}
          {step === "resultado" && result ? (
            <StepResultado aplicados={result.aplicados} ignorados={result.ignorados} />
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-border p-4">
          {step === "vista_previa" ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep("archivo");
                setPreview(null);
              }}
              disabled={isPending}
            >
              <ChevronLeft className="size-4" />
              {t("volver")}
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            {step === "archivo" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                {t("cancelar")}
              </Button>
            ) : null}
            {step === "vista_previa" && preview ? (
              <Button
                type="button"
                onClick={handleCommit}
                disabled={
                  isPending ||
                  (preview.counts.invalid > 0 && !ignorarInvalidos) ||
                  preview.counts.new + preview.counts.updated === 0
                }
              >
                {t("importar")}
              </Button>
            ) : null}
            {step === "resultado" ? (
              <Button type="button" onClick={() => handleOpenChange(false)}>
                {t("cerrar")}
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function trimIfStr(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function mapError(code: string, t: (k: string) => string): string {
  switch (code) {
    case "archivo_vacio":
      return t("errorArchivoVacio");
    case "demasiadas_filas":
      return t("errorDemasiadasFilas");
    case "tiene_invalidos":
      return t("errorTieneInvalidos");
    case "duplicate_codigo":
      return t("errorDuplicateCodigo");
    case "forbidden":
      return t("errorForbidden");
    default:
      return t("errorDesconocido");
  }
}

function StepArchivo({
  fileName,
  onPick,
  fileInputRef,
  onFile,
  disabled,
}: {
  fileName: string | null;
  onPick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f: File) => void;
  disabled: boolean;
}) {
  const t = useTranslations("inventario.importar");
  return (
    <div className="flex flex-col gap-6">
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-border p-10 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
      >
        <UploadCloud className="size-10 text-muted-foreground" />
        <div className="text-sm text-muted-foreground">{t("dropZone")}</div>
        <Button type="button" variant="outline" onClick={onPick} disabled={disabled}>
          <FileSpreadsheet className="size-4" />
          {t("elegirArchivo")}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        {fileName ? (
          <div className="text-xs text-muted-foreground">{fileName}</div>
        ) : null}
      </div>

      <div className="rounded-md border border-border p-4">
        <div className="text-sm font-medium">{t("formatoEsperado")}</div>
        <p className="mt-1 text-xs text-muted-foreground">{t("formatoAyuda")}</p>
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <li>
            <code>Código</code> *
          </li>
          <li>
            <code>Descripción</code> *
          </li>
          <li>
            <code>Categoría</code>
          </li>
          <li>
            <code>Localidad</code>
          </li>
          <li>
            <code>Unidad productiva</code>
          </li>
          <li>
            <code>Unidad de medida</code>
          </li>
          <li>
            <code>Stock mínimo</code>
          </li>
          <li>
            <code>Valor unitario</code>
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">{t("formatoStock")}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ImportPreviewRow["status"] }) {
  const t = useTranslations("inventario.importar.estado");
  const map: Record<
    ImportPreviewRow["status"],
    { label: string; className: string }
  > = {
    new: {
      label: t("new"),
      className: "bg-primary/15 text-primary",
    },
    updated: {
      label: t("updated"),
      className: "border border-border text-foreground",
    },
    unchanged: {
      label: t("unchanged"),
      className: "bg-muted text-muted-foreground",
    },
    invalid: {
      label: t("invalid"),
      className: "bg-destructive/15 text-destructive",
    },
  };
  const item = map[status];
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${item.className}`}
    >
      {item.label}
    </span>
  );
}

function StepVistaPrevia({
  preview,
  ignorarInvalidos,
  onToggleIgnorar,
}: {
  preview: ImportPreview;
  ignorarInvalidos: boolean;
  onToggleIgnorar: (v: boolean) => void;
}) {
  const t = useTranslations("inventario.importar");
  const shown = preview.rows.slice(0, 50);
  const extra = preview.rows.length - shown.length;
  const reasonT = useTranslations("inventario.importar.motivo");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="rounded-md border border-border p-3">
          <div className="text-muted-foreground">{t("estado.new")}</div>
          <div className="mt-1 text-lg tabular-nums">{preview.counts.new}</div>
        </div>
        <div className="rounded-md border border-border p-3">
          <div className="text-muted-foreground">{t("estado.updated")}</div>
          <div className="mt-1 text-lg tabular-nums">{preview.counts.updated}</div>
        </div>
        <div className="rounded-md border border-border p-3">
          <div className="text-muted-foreground">{t("estado.unchanged")}</div>
          <div className="mt-1 text-lg tabular-nums">{preview.counts.unchanged}</div>
        </div>
        <div className="rounded-md border border-border p-3">
          <div className="text-muted-foreground">{t("estado.invalid")}</div>
          <div className="mt-1 text-lg tabular-nums">{preview.counts.invalid}</div>
        </div>
      </div>

      {preview.counts.invalid > 0 ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={ignorarInvalidos}
            onCheckedChange={(v) => onToggleIgnorar(v === true)}
          />
          {t("ignorarInvalidos")}
        </label>
      ) : null}

      <div className="rounded-md border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">#</th>
                <th className="px-2 py-1.5 text-left font-medium">
                  {t("columnas.estado")}
                </th>
                <th className="px-2 py-1.5 text-left font-medium">
                  {t("columnas.codigo")}
                </th>
                <th className="px-2 py-1.5 text-left font-medium">
                  {t("columnas.descripcion")}
                </th>
                <th className="px-2 py-1.5 text-left font-medium">
                  {t("columnas.detalle")}
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.rowIndex} className="border-t border-border">
                  <td className="px-2 py-1 text-muted-foreground tabular-nums">
                    {row.rowIndex}
                  </td>
                  <td className="px-2 py-1">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-2 py-1 font-mono">{row.codigo ?? "—"}</td>
                  <td className="px-2 py-1">{row.descripcion ?? "—"}</td>
                  <td className="px-2 py-1 text-muted-foreground">
                    {row.status === "invalid" && row.invalidReason
                      ? reasonT(row.invalidReason)
                      : null}
                    {row.status === "updated" && row.changedFields
                      ? row.changedFields.join(", ")
                      : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {extra > 0 ? (
          <div className="border-t border-border px-2 py-1.5 text-xs text-muted-foreground">
            {t("masFilas", { count: extra })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StepResultado({
  aplicados,
  ignorados,
}: {
  aplicados: number;
  ignorados: number;
}) {
  const t = useTranslations("inventario.importar");
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <Badge variant="outline" className="text-base px-3 py-1">
        {t("resultado.titulo")}
      </Badge>
      <div className="text-sm">{t("resultado.aplicados", { count: aplicados })}</div>
      {ignorados > 0 ? (
        <div className="text-sm text-muted-foreground">
          {t("resultado.ignorados", { count: ignorados })}
        </div>
      ) : null}
    </div>
  );
}
