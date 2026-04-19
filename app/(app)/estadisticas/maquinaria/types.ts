export const MAQ_RANGES = ["90d", "ytd", "todo"] as const;
export type MaqRange = (typeof MAQ_RANGES)[number];

export const MIN_FILTROS = ["min2", "min3", "todas"] as const;
export type MinFiltro = (typeof MIN_FILTROS)[number];

export type MaqRow = {
  id: number;
  nombre: string;
  tipoId: number | null;
  tipoNombre: string | null;
  correctivos: number;
  preventivos: number;
  mtbfDias: number | null;
  horasOperadas: number | null;
  costoTotal: number;
};

export type MaqResult = {
  rows: MaqRow[];
  sinHistorial: number;
  totalMaquinas: number;
};
