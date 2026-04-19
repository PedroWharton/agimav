export type EmpresaBlock = {
  nombre: string;
  cuit: string | null;
  direccion: string | null;
};

export function getEmpresaBlock(): EmpresaBlock {
  return {
    nombre: process.env.EMPRESA_NOMBRE ?? "Agimav",
    cuit: process.env.EMPRESA_CUIT ?? null,
    direccion: process.env.EMPRESA_DIRECCION ?? null,
  };
}
