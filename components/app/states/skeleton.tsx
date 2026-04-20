import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Shimmer base class. Uses a `::after` gradient that slides from left to right,
 * driven by the `sk-shimmer` keyframe defined in `app/globals.css`.
 */
const shimmerBase = cn(
  "relative overflow-hidden rounded bg-[color-mix(in_oklch,var(--muted)_70%,var(--card))]",
  "after:absolute after:inset-0 after:content-['']",
  "after:bg-[linear-gradient(90deg,transparent_0%,color-mix(in_oklch,var(--card)_30%,transparent)_50%,transparent_100%)]",
  "after:animate-[sk-shimmer_1.6s_infinite]",
);

type BoxProps = HTMLAttributes<HTMLDivElement>;

type LineWidth = 40 | 60 | 80 | 100;

function lineClass(line: LineWidth): string {
  switch (line) {
    case 40:
      return "w-[40%]";
    case 60:
      return "w-[60%]";
    case 80:
      return "w-[80%]";
    case 100:
    default:
      return "w-full";
  }
}

function SkeletonText({
  line = 100,
  className,
  ...rest
}: BoxProps & { line?: LineWidth }) {
  return (
    <div
      aria-hidden
      className={cn(shimmerBase, "h-3", lineClass(line), className)}
      {...rest}
    />
  );
}

function SkeletonTitle({
  line,
  className,
  ...rest
}: BoxProps & { line?: LineWidth }) {
  return (
    <div
      aria-hidden
      className={cn(
        shimmerBase,
        "h-[18px]",
        line ? lineClass(line) : "w-[60%]",
        className,
      )}
      {...rest}
    />
  );
}

function SkeletonChip({ className, ...rest }: BoxProps) {
  return (
    <div
      aria-hidden
      className={cn(shimmerBase, "h-[18px] w-[60px] rounded-full", className)}
      {...rest}
    />
  );
}

function SkeletonAvatar({ className, ...rest }: BoxProps) {
  return (
    <div
      aria-hidden
      className={cn(shimmerBase, "h-9 w-9 rounded-full", className)}
      {...rest}
    />
  );
}

function SkeletonBox({ className, ...rest }: BoxProps) {
  return (
    <div
      aria-hidden
      className={cn(shimmerBase, "h-20 w-full", className)}
      {...rest}
    />
  );
}

export const Skeleton = {
  Text: SkeletonText,
  Title: SkeletonTitle,
  Chip: SkeletonChip,
  Avatar: SkeletonAvatar,
  Box: SkeletonBox,
};

export type { LineWidth as SkeletonLineWidth };
