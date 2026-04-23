export const MAQ_RANGES = ["90d", "ytd", "todo"] as const;
export type MaqRange = (typeof MAQ_RANGES)[number];

export const MIN_FILTROS = ["min2", "min3", "todas"] as const;
export type MinFiltro = (typeof MIN_FILTROS)[number];

export type MtbfSource = "horas" | "dias" | null;

export type MaqRow = {
  id: number;
  nombre: string;
  tipoId: number | null;
  tipoNombre: string | null;
  correctivos: number;
  preventivos: number;
  /** MTBF value in the unit indicated by `mtbfSource`. Null when <2 correctivos. */
  mtbf: number | null;
  mtbfSource: MtbfSource;
  horasOperadas: number | null;
  costoTotal: number;
};

export type MaqResult = {
  rows: MaqRow[];
  sinHistorial: number;
  totalMaquinas: number;
};
