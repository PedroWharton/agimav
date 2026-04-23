export type StatsRangeKey = "30d" | "90d" | "ytd" | "todo";

const DAY_MS = 24 * 60 * 60 * 1000;

export function rangeToGte(range: StatsRangeKey): Date | null {
  const now = new Date();
  switch (range) {
    case "30d":
      return new Date(now.getTime() - 30 * DAY_MS);
    case "90d":
      return new Date(now.getTime() - 90 * DAY_MS);
    case "ytd":
      return new Date(now.getFullYear(), 0, 1);
    case "todo":
      return null;
  }
}
