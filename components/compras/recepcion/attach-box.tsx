"use client";

import { Upload, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

import { cn } from "@/lib/utils";

export type AttachedDraft = {
  id: string;
  file: File;
  name: string;
  sizeBytes: number;
};

export type AttachBoxProps = {
  files: AttachedDraft[];
  onAdd: (files: AttachedDraft[]) => void;
  onRemove: (id: string) => void;
  accept?: string;
  multiple?: boolean;
  className?: string;
};

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const n = bytes / Math.pow(1024, exp);
  const rounded = n >= 10 || exp === 0 ? Math.round(n) : Math.round(n * 10) / 10;
  return `${rounded} ${units[exp]}`;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function fromFileList(list: FileList | File[]): AttachedDraft[] {
  const arr = Array.from(list);
  return arr.map((file) => ({
    id: randomId(),
    file,
    name: file.name,
    sizeBytes: file.size,
  }));
}

export function AttachBox({
  files,
  onAdd,
  onRemove,
  accept = "image/*,application/pdf",
  multiple = true,
  className,
}: AttachBoxProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (!e.dataTransfer?.files?.length) return;
    const drafts = fromFileList(e.dataTransfer.files);
    onAdd(multiple ? drafts : drafts.slice(0, 1));
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          if (!e.target.files?.length) return;
          const drafts = fromFileList(e.target.files);
          onAdd(multiple ? drafts : drafts.slice(0, 1));
          e.target.value = "";
        }}
      />

      {files.length === 0 ? (
        <button
          type="button"
          onClick={openPicker}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted-2/40 px-4 py-6 text-center text-[12.5px] text-muted-foreground transition-colors",
            "hover:border-brand hover:bg-brand-weak hover:text-brand",
            dragOver && "border-brand bg-brand-weak text-brand",
          )}
        >
          <Upload className="size-5" aria-hidden />
          <span className="font-medium">
            Arrastrá archivos o hacé clic para seleccionar
          </span>
          <span className="text-[11px] text-muted-foreground">
            {accept.includes("pdf") ? "PDF o imágenes" : accept}
          </span>
        </button>
      ) : (
        <>
          <ul className="flex flex-col gap-1.5">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
              >
                <Upload className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1 truncate text-[12.5px] font-medium">
                  {f.name}
                </span>
                <span className="font-mono text-[10.5px] text-muted-foreground tabular-nums">
                  {formatSize(f.sizeBytes)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(f.id)}
                  aria-label={`Quitar ${f.name}`}
                  className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={openPicker}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-[11.5px] text-muted-foreground transition-colors",
              "hover:border-brand hover:bg-brand-weak hover:text-brand",
              dragOver && "border-brand bg-brand-weak text-brand",
            )}
          >
            <Upload className="size-3.5" aria-hidden />
            Agregar más
          </button>
        </>
      )}
    </div>
  );
}
