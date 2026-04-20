import {
  File as FileIcon,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import type { ComponentType } from "react";

import { EmptyState } from "@/components/app/states";
import { cn } from "@/lib/utils";

export type AttachedFile = {
  id: string;
  name: string;
  sizeBytes: number;
  url?: string;
  uploadedAt: Date;
  uploadedBy: string;
};

type LucideIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

function iconForFile(name: string): LucideIcon {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext))
    return FileImage;
  if (["pdf", "doc", "docx", "txt", "md"].includes(ext)) return FileText;
  if (["xls", "xlsx", "csv"].includes(ext)) return FileSpreadsheet;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return FileArchive;
  return FileIcon;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(d);
}

/**
 * Archivos adjuntos grid (§4.12). v1 renders the tiles when provided; the
 * upload/storage pipeline is deferred (Q13), so empty is the typical state.
 */
export function FilesGrid({
  files,
  className,
}: {
  files: AttachedFile[];
  className?: string;
}) {
  if (files.length === 0) {
    return (
      <EmptyState
        variant="no-data"
        title="Sin archivos adjuntos"
        description="El soporte de archivos llegará pronto."
        className={className}
      />
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4",
        className,
      )}
    >
      {files.map((file) => {
        const Icon = iconForFile(file.name);
        const Wrapper: "a" | "div" = file.url ? "a" : "div";
        return (
          <Wrapper
            key={file.id}
            {...(file.url ? { href: file.url } : {})}
            className={cn(
              "flex min-w-0 flex-col gap-1.5 rounded-lg border border-transparent bg-muted p-3 transition-colors",
              file.url && "hover:border-border-strong",
            )}
          >
            <div className="grid aspect-[4/3] place-items-center rounded-md bg-card text-subtle-foreground">
              <Icon aria-hidden className="size-7" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">
                {file.name}
              </div>
              <div className="mt-0.5 font-mono text-[10.5px] text-subtle-foreground">
                {formatSize(file.sizeBytes)} · {formatDate(file.uploadedAt)}
              </div>
            </div>
          </Wrapper>
        );
      })}
    </div>
  );
}
