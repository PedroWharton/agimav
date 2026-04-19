import { format } from "date-fns";
import { es } from "date-fns/locale";
import { renderToBuffer } from "@react-pdf/renderer";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEmpresaBlock } from "@/lib/compras/empresa";
import { formatOCNumber } from "@/lib/compras/oc-number";
import { OcPdf, type OcPdfData } from "@/components/compras/oc-pdf";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: idParam } = await ctx.params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id)) {
    return new Response("Not found", { status: 404 });
  }

  const oc = await prisma.ordenCompra.findUnique({
    where: { id },
    include: {
      proveedor: {
        select: {
          nombre: true,
          cuit: true,
          condicionIva: true,
          direccionFiscal: true,
        },
      },
      detalle: {
        orderBy: { id: "asc" },
        include: {
          requisicionDetalle: {
            include: {
              item: {
                select: {
                  codigo: true,
                  descripcion: true,
                  unidadMedida: true,
                },
              },
              requisicion: {
                select: {
                  id: true,
                  solicitante: true,
                  unidadProductiva: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!oc) {
    return new Response("Not found", { status: 404 });
  }

  const requisicionOrigen = oc.detalle[0]?.requisicionDetalle.requisicion ?? null;
  const numeroOc = oc.numeroOc ?? formatOCNumber(oc.id);
  const subtotal = oc.detalle.reduce((s, d) => s + d.total, 0);

  const data: OcPdfData = {
    numeroOc,
    fechaEmision: format(oc.fechaEmision, "dd/MM/yyyy", { locale: es }),
    estado: oc.estado,
    comprador: oc.comprador,
    observaciones: oc.observaciones,
    empresa: getEmpresaBlock(),
    proveedor: {
      nombre: oc.proveedor.nombre,
      cuit: oc.proveedor.cuit,
      condicionIva: oc.proveedor.condicionIva,
      direccionFiscal: oc.proveedor.direccionFiscal,
    },
    requisicion: requisicionOrigen
      ? {
          numero: `#${requisicionOrigen.id}`,
          solicitante: requisicionOrigen.solicitante,
          unidadProductiva: requisicionOrigen.unidadProductiva,
        }
      : null,
    lineas: oc.detalle.map((d, idx) => ({
      orden: idx + 1,
      codigo: d.requisicionDetalle.item.codigo ?? "",
      descripcion: d.requisicionDetalle.item.descripcion ?? "",
      cantidad: d.cantidadSolicitada,
      unidadMedida: d.requisicionDetalle.item.unidadMedida,
      precioUnitario: d.precioUnitario,
      total: d.total,
    })),
    subtotal,
  };

  const buffer = await renderToBuffer(<OcPdf data={data} />);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${numeroOc}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
