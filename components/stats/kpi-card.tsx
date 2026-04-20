import Link from "next/link";
import { ArrowDown, ArrowUp, Minus, type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiTone = "neutral" | "warn" | "danger" | "ok" | "info";
type TrendDirection = "up" | "down" | "flat";

type KpiTrend = {
  direction: TrendDirection;
  /** Positive means "up is good"; negative means "up is bad" (flips arrow color). Default positive. */
  polarity?: "positive" | "negative";
  label: string;
};

const TONE_STYLES: Record<
  KpiTone,
  { value: string; tint: string; iconWrap: string }
> = {
  neutral: {
    value: "text-foreground",
    tint: "",
    iconWrap: "text-muted-foreground",
  },
  warn: {
    value: "text-warn",
    tint: "bg-gradient-to-b from-warn-weak to-transparent to-70%",
    iconWrap: "text-warn",
  },
  danger: {
    value: "text-danger",
    tint: "bg-gradient-to-b from-danger-weak to-transparent to-70%",
    iconWrap: "text-danger",
  },
  ok: {
    value: "text-success",
    tint: "bg-gradient-to-b from-success-weak to-transparent to-70%",
    iconWrap: "text-success",
  },
  info: {
    value: "text-info",
    tint: "bg-gradient-to-b from-info-weak to-transparent to-70%",
    iconWrap: "text-info",
  },
};

function trendTone(
  direction: TrendDirection,
  polarity: "positive" | "negative",
): string {
  if (direction === "flat") return "text-muted-foreground";
  const good =
    (direction === "up" && polarity === "positive") ||
    (direction === "down" && polarity === "negative");
  return good ? "text-success" : "text-danger";
}

function TrendIcon({ direction }: { direction: TrendDirection }) {
  if (direction === "up") return <ArrowUp className="size-3" aria-hidden />;
  if (direction === "down") return <ArrowDown className="size-3" aria-hidden />;
  return <Minus className="size-3" aria-hidden />;
}

export function KpiCard({
  label,
  value,
  caption,
  icon: Icon,
  href,
  children,
  tone = "neutral",
  trend,
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
  trend?: KpiTrend;
  className?: string;
}) {
  const t: KpiTone = tone === "default" ? "neutral" : tone;
  const styles = TONE_STYLES[t];

  const body = (
    <Card
      className={cn(
        "relative flex h-full min-h-[88px] flex-col gap-1.5 overflow-hidden p-4",
        styles.tint,
        href &&
          "transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-sm cursor-pointer",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
        {Icon ? (
          <Icon
            className={cn("size-[13px] shrink-0", styles.iconWrap)}
            strokeWidth={1.75}
            aria-hidden
          />
        ) : null}
        <span>{label}</span>
      </div>
      <div
        className={cn(
          "font-heading text-2xl font-semibold leading-[1.15] tracking-tight tabular-nums",
          styles.value,
        )}
      >
        {value}
      </div>
      {trend ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn(
              "flex items-center gap-0.5 font-medium",
              trendTone(trend.direction, trend.polarity ?? "positive"),
            )}
          >
            <TrendIcon direction={trend.direction} />
            {trend.label}
          </span>
        </div>
      ) : caption ? (
        <div className="text-xs text-muted-foreground">{caption}</div>
      ) : null}
      {children ? <div className="mt-auto pt-1">{children}</div> : null}
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
