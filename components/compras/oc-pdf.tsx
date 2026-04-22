import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

export type OcPdfLine = {
  orden: number;
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidadMedida: string | null;
  precioUnitario: number;
  total: number;
};

export type OcPdfData = {
  numeroOc: string;
  fechaEmision: string;
  estado: string;
  comprador: string | null;
  observaciones: string | null;
  empresa: {
    nombre: string;
    cuit: string | null;
    direccion: string | null;
  };
  proveedor: {
    nombre: string;
    cuit: string | null;
    condicionIva: string | null;
    direccionFiscal: string | null;
  };
  solicitud: {
    numero: string;
    solicitante: string;
    unidadProductiva: string;
  } | null;
  lineas: OcPdfLine[];
  subtotal: number;
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0f172a",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottom: "1pt solid #0f172a",
    paddingBottom: 12,
    marginBottom: 12,
  },
  headerCol: {
    flexDirection: "column",
    maxWidth: "48%",
  },
  h1: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  h2: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 4,
  },
  muted: {
    color: "#64748b",
    fontSize: 9,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  metaCell: {
    flexDirection: "column",
    marginRight: 12,
  },
  table: {
    marginTop: 12,
    border: "1pt solid #e2e8f0",
  },
  thead: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottom: "1pt solid #e2e8f0",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  th: {
    fontWeight: 700,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tr: {
    flexDirection: "row",
    borderBottom: "0.5pt solid #e2e8f0",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  colOrden: { width: "6%" },
  colCodigo: { width: "16%" },
  colDesc: { width: "40%" },
  colCant: { width: "10%", textAlign: "right" },
  colUnid: { width: "8%" },
  colPrecio: { width: "10%", textAlign: "right" },
  colTotal: { width: "10%", textAlign: "right" },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  totalsBlock: {
    width: "40%",
    borderTop: "1pt solid #e2e8f0",
    paddingTop: 6,
    flexDirection: "column",
  },
  totalsLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  totalsLabel: { fontSize: 10, color: "#64748b" },
  totalsValue: { fontSize: 11, fontWeight: 700 },
  footer: {
    marginTop: 20,
    fontSize: 9,
    color: "#64748b",
    borderTop: "1pt solid #e2e8f0",
    paddingTop: 6,
  },
});

function formatARS(n: number): string {
  if (!n) return "—";
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function OcPdf({ data }: { data: OcPdfData }) {
  return (
    <Document title={`Orden de Compra ${data.numeroOc}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.headerCol}>
            <Text style={styles.h2}>{data.empresa.nombre}</Text>
            {data.empresa.cuit ? (
              <Text style={styles.muted}>CUIT {data.empresa.cuit}</Text>
            ) : null}
            {data.empresa.direccion ? (
              <Text style={styles.muted}>{data.empresa.direccion}</Text>
            ) : null}
          </View>
          <View style={styles.headerCol}>
            <Text style={styles.h1}>Orden de Compra</Text>
            <Text style={styles.muted}>Nº {data.numeroOc}</Text>
            <Text style={styles.muted}>
              Fecha {data.fechaEmision} · {data.estado}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCell}>
            <Text style={styles.muted}>Proveedor</Text>
            <Text style={{ fontWeight: 700 }}>{data.proveedor.nombre}</Text>
            {data.proveedor.cuit ? (
              <Text style={styles.muted}>CUIT {data.proveedor.cuit}</Text>
            ) : null}
            {data.proveedor.condicionIva ? (
              <Text style={styles.muted}>
                {data.proveedor.condicionIva}
              </Text>
            ) : null}
            {data.proveedor.direccionFiscal ? (
              <Text style={styles.muted}>
                {data.proveedor.direccionFiscal}
              </Text>
            ) : null}
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.muted}>Comprador</Text>
            <Text>{data.comprador ?? "—"}</Text>
            {data.solicitud ? (
              <>
                <Text style={[styles.muted, { marginTop: 4 }]}>
                  Solicitud origen
                </Text>
                <Text>
                  #{data.solicitud.numero} · {data.solicitud.solicitante}
                </Text>
                <Text style={styles.muted}>
                  {data.solicitud.unidadProductiva}
                </Text>
              </>
            ) : null}
          </View>
        </View>

        {data.observaciones ? (
          <View style={{ marginBottom: 8 }}>
            <Text style={styles.muted}>Observaciones</Text>
            <Text>{data.observaciones}</Text>
          </View>
        ) : null}

        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.colOrden]}>#</Text>
            <Text style={[styles.th, styles.colCodigo]}>Código</Text>
            <Text style={[styles.th, styles.colDesc]}>Descripción</Text>
            <Text style={[styles.th, styles.colCant]}>Cant.</Text>
            <Text style={[styles.th, styles.colUnid]}>Unid.</Text>
            <Text style={[styles.th, styles.colPrecio]}>P. Unit</Text>
            <Text style={[styles.th, styles.colTotal]}>Subtotal</Text>
          </View>
          {data.lineas.map((l) => (
            <View key={l.orden} style={styles.tr} wrap={false}>
              <Text style={styles.colOrden}>{l.orden}</Text>
              <Text style={styles.colCodigo}>{l.codigo || "—"}</Text>
              <Text style={styles.colDesc}>{l.descripcion || "—"}</Text>
              <Text style={styles.colCant}>{l.cantidad}</Text>
              <Text style={styles.colUnid}>{l.unidadMedida ?? ""}</Text>
              <Text style={styles.colPrecio}>
                {formatARS(l.precioUnitario)}
              </Text>
              <Text style={styles.colTotal}>{formatARS(l.total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsRow}>
          <View style={styles.totalsBlock}>
            <View style={styles.totalsLine}>
              <Text style={styles.totalsLabel}>Subtotal estimado</Text>
              <Text style={styles.totalsValue}>
                {formatARS(data.subtotal)}
              </Text>
            </View>
            <Text style={styles.muted}>
              IVA y totales definitivos al recibir factura.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>
            Documento generado por Agimav · {new Date().toLocaleDateString("es-AR")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
