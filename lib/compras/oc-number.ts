export function formatOCNumber(id: number): string {
  return `OC-${String(id).padStart(6, "0")}`;
}
