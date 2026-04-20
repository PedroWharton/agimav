import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type EmptyStateVariant = "no-results" | "no-data" | "empty-tab";

type EmptyStateProps = {
  variant?: EmptyStateVariant;
  icon?: ReactNode;
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

const defaultCopy: Record<EmptyStateVariant, { title: string; description: string }> = {
  "no-results": {
    title: "Sin resultados",
    description: "No encontramos coincidencias para los filtros aplicados. Probá quitar algún filtro o ajustar la búsqueda.",
  },
  "no-data": {
    title: "Todavía no hay datos",
    description: "Cuando tu equipo empiece a cargar información, aparecerá acá.",
  },
  "empty-tab": {
    title: "Sin registros",
    description: "Esta sección todavía no tiene contenido cargado.",
  },
};

function DefaultIcon({ variant }: { variant: EmptyStateVariant }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-6 w-6",
    "aria-hidden": true,
  };
  switch (variant) {
    case "no-results":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
          <path d="M8 11h6" />
        </svg>
      );
    case "no-data":
      return (
        <svg {...common}>
          <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
          <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />
        </svg>
      );
    case "empty-tab":
    default:
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
  }
}

export function EmptyState({
  variant = "no-data",
  icon,
  title,
  description,
  actions,
  className,
}: EmptyStateProps) {
  const copy = defaultCopy[variant];
  const resolvedTitle = title ?? copy.title;
  const resolvedDescription = description ?? copy.description;

  return (
    <div
      className={cn(
        "mx-auto flex max-w-[420px] flex-col items-center gap-3.5 px-5 py-8 text-center",
        className,
      )}
    >
      <div className="grid size-14 place-items-center rounded-[14px] bg-muted text-muted-foreground">
        {icon ?? <DefaultIcon variant={variant} />}
      </div>
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold tracking-tight">{resolvedTitle}</h3>
        {resolvedDescription ? (
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            {resolvedDescription}
          </p>
        ) : null}
      </div>
      {actions ? <div className="mt-1 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
