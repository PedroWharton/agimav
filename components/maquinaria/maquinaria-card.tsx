import { cn } from "@/lib/utils";
import { StatusChip, type ChipTone } from "@/components/app/status-chip";
import {
  statusChip,
  serviceHealth,
  EquipIcon,
} from "@/components/maquinaria/helpers";

export type MaquinariaCardData = {
  id: number;
  /** Display name — usually the `esPrincipal` atributo value. */
  title: string;
  /** Secondary line e.g. `N° Serie 0028847 · 2019`. */
  subtitle?: string | null;
  /** Legacy tipo name (used to derive the glyph + optional chip). */
  tipoNombre: string;
  /** Optional tipo unit abbreviation (hs, km). Displayed next to horas. */
  unidadAbrev?: string | null;
  /** Legacy machine code, like `MAQ-042`. Uses nroSerie as a fallback. */
  codigo?: string | null;
  estado: string;
  horasAcumuladas: number;
  /** Optional meta rows — rendered after horas. Truncated to one line each. */
  meta?: Array<{ label: string; value: string }>;
  /** Optional scheduled-service horas target (for health bar). */
  proxHoras?: number | null;
};

const PROGRESS_TONE: Record<ChipTone, string> = {
  ok: "bg-success",
  warn: "bg-warn",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-muted-foreground/40",
};

export function MaquinariaCard({
  data,
  onClick,
  className,
}: {
  data: MaquinariaCardData;
  onClick?: (data: MaquinariaCardData) => void;
  className?: string;
}) {
  const chip = statusChip(data.estado);
  const health = serviceHealth({
    estado: data.estado,
    horasAcumuladas: data.horasAcumuladas,
    proxHoras: data.proxHoras ?? null,
  });
  const fmtInt = (n: number) => n.toLocaleString("es-AR");
  const codigoLabel = data.codigo || `#${data.id}`;

  const clickable = typeof onClick === "function";

  return (
    <article
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onClick!(data) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick!(data);
              }
            }
          : undefined
      }
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-colors",
        clickable && "cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div className="relative flex h-28 items-center justify-center bg-muted-2 text-muted-foreground">
        <EquipIcon tipo={data.tipoNombre} aria-hidden className="size-12 opacity-80" />
        <span className="absolute left-2.5 top-2.5 rounded-md border border-border bg-card/85 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-foreground backdrop-blur-sm">
          {codigoLabel}
        </span>
        <span className="absolute right-2.5 top-2.5">
          <StatusChip tone={chip.tone} dot label={chip.label} />
        </span>
      </div>

      <div className="flex flex-col gap-2 p-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {data.title || "—"}
          </h3>
          {data.subtitle ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {data.subtitle}
            </p>
          ) : null}
        </div>

        <dl className="flex flex-col gap-1 text-[12px] text-muted-foreground">
          {data.meta?.map((m, i) => (
            <div
              key={`${m.label}-${i}`}
              className="flex items-center justify-between gap-3"
            >
              <dt className="shrink-0">{m.label}</dt>
              <dd className="max-w-[60%] truncate text-right font-medium text-foreground">
                {m.value || "—"}
              </dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3">
            <dt className="shrink-0">Horas</dt>
            <dd className="font-medium tabular-nums text-foreground">
              {fmtInt(data.horasAcumuladas)}
              {data.unidadAbrev ? ` ${data.unidadAbrev}` : " hs"}
            </dd>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-3">
            <dt className="shrink-0">Próx. servicio</dt>
            <dd className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-1.5 w-20 overflow-hidden rounded-full bg-muted"
              >
                <span
                  className={cn("block h-full", PROGRESS_TONE[health.tone])}
                  style={{ width: `${health.pct}%` }}
                />
              </span>
              <span className="tabular-nums text-[11px] text-muted-foreground">
                {health.label}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
