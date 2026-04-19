import { cn } from "@/lib/utils";

export function AbcBadge({ clase }: { clase: "A" | "B" | "C" }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 text-xs font-semibold",
        clase === "A" &&
          "bg-sky-500/10 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
        clase === "B" &&
          "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
        clase === "C" && "bg-muted text-muted-foreground",
      )}
    >
      {clase}
    </span>
  );
}
