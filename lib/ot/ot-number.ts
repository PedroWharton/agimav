export function formatOTNumber(id: number): string {
  return `OT-${String(id).padStart(6, "0")}`;
}
