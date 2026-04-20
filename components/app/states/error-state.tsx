import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ErrorStateVariant = "server" | "forbidden" | "offline";

type ErrorStateProps = {
  variant?: ErrorStateVariant;
  icon?: ReactNode;
  title?: string;
  description?: ReactNode;
  trace?: string;
  actions?: ReactNode;
  className?: string;
};

const defaultCopy: Record<ErrorStateVariant, { title: string; description: string }> = {
  server: {
    title: "Algo salió mal",
    description:
      "Hubo un problema del lado del servidor. Intentá de nuevo en unos segundos. Si el problema persiste, avisale al administrador.",
  },
  forbidden: {
    title: "No tenés permisos para ver esto",
    description: "Esta sección requiere un rol con acceso. Contactá a un administrador si creés que deberías tenerlo.",
  },
  offline: {
    title: "Sin conexión",
    description:
      "No hay internet o el servidor no responde. Verificá tu conexión e intentá de nuevo. Los cambios no guardados se mantienen en el formulario.",
  },
};

const iconToneByVariant: Record<ErrorStateVariant, string> = {
  server: "bg-danger-weak text-danger",
  forbidden: "bg-muted text-muted-foreground",
  offline: "bg-warn-weak text-warn",
};

function DefaultIcon({ variant }: { variant: ErrorStateVariant }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-6 w-6",
    "aria-hidden": true,
  };
  switch (variant) {
    case "server":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      );
    case "forbidden":
      return (
        <svg {...common}>
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case "offline":
    default:
      return (
        <svg {...common}>
          <path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 5-2.7M2 8.5a16 16 0 0 1 4-2.5M12 20h.01" />
        </svg>
      );
  }
}

export function ErrorState({
  variant = "server",
  icon,
  title,
  description,
  trace,
  actions,
  className,
}: ErrorStateProps) {
  const copy = defaultCopy[variant];
  const resolvedTitle = title ?? copy.title;
  const resolvedDescription = description ?? copy.description;

  return (
    <div
      role="alert"
      className={cn(
        "mx-auto flex max-w-[440px] flex-col items-center gap-3.5 px-5 py-8 text-center",
        className,
      )}
    >
      <div
        className={cn(
          "grid size-14 place-items-center rounded-[14px]",
          iconToneByVariant[variant],
        )}
      >
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
      {trace ? (
        <pre className="max-h-[100px] w-full overflow-auto rounded-md bg-muted px-3 py-2.5 text-left font-mono text-[11px] text-muted-foreground">
          {trace}
        </pre>
      ) : null}
      {actions ? <div className="mt-1 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
