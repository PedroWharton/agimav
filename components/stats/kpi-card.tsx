import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiTone = "neutral" | "warn" | "danger" | "ok" | "info";

const TONE_STYLES: Record<KpiTone, { icon: string; value: string }> = {
  neutral: {
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
  },
  warn: {
    icon: "bg-warn-weak text-warn",
    value: "text-warn",
  },
  danger: {
    icon: "bg-danger-weak text-danger",
    value: "text-danger",
  },
  ok: {
    icon: "bg-success-weak text-success",
    value: "text-success",
  },
  info: {
    icon: "bg-info-weak text-info",
    value: "text-info",
  },
};

export function KpiCard({
  label,
  value,
  caption,
  icon: Icon,
  href,
  children,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string | number;
  caption?: string;
  icon?: LucideIcon;
  href?: string;
  children?: React.ReactNode;
  /**
   * Visual tone. `"default"` is a deprecated alias of `"neutral"` and is kept
   * only so existing call sites don't break.
   */
  tone?: KpiTone | "default";
  className?: string;
}) {
  const t: KpiTone = tone === "default" ? "neutral" : tone;
  const styles = TONE_STYLES[t];

  const body = (
    <Card
      className={cn(
        "flex h-full flex-col gap-3 p-5",
        href &&
          "transition-colors hover:bg-muted/40 hover:ring-foreground/20",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className={cn("rounded-md p-2", styles.icon)}>
            <Icon className="size-5" />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
          <span
            className={cn(
              "font-heading text-3xl font-semibold leading-none",
              styles.value,
            )}
          >
            {value}
          </span>
          {caption ? (
            <span className="mt-1 text-xs text-muted-foreground">
              {caption}
            </span>
          ) : null}
        </div>
      </div>
      {children ? <div className="mt-auto">{children}</div> : null}
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {body}
      </Link>
    );
  }
  return body;
}
