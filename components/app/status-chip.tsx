import { cn } from "@/lib/utils";

export type ChipTone = "neutral" | "ok" | "warn" | "danger" | "info";

export type StatusChipProps = {
  tone: ChipTone;
  label: string;
  /** When true, prepend a small colored dot in the matching strong tone. */
  dot?: boolean;
  className?: string;
};

const TONE_BG: Record<ChipTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  ok: "bg-success-weak text-success",
  warn: "bg-warn-weak text-warn",
  danger: "bg-danger-weak text-danger",
  info: "bg-info-weak text-info",
};

const TONE_DOT: Record<ChipTone, string> = {
  neutral: "bg-muted-foreground",
  ok: "bg-success",
  warn: "bg-warn",
  danger: "bg-danger",
  info: "bg-info",
};

export function StatusChip({ tone, label, dot, className }: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_BG[tone],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("inline-block size-1.5 rounded-full", TONE_DOT[tone])}
        />
      ) : null}
      {label}
    </span>
  );
}
