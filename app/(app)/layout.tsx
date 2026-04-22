import { Sidebar, type SidebarBadges } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { comprasPendientesRecepcion } from "@/lib/compras/pending-badge";
import { prisma } from "@/lib/db";

async function loadSidebarBadges(): Promise<SidebarBadges> {
  const [bajoMinimo, comprasPendientes] = await Promise.all([
    prisma.inventario.count({
      where: {
        stockMinimo: { gt: 0 },
        stock: { lt: prisma.inventario.fields.stockMinimo },
      },
    }),
    comprasPendientesRecepcion(),
  ]);
  return {
    "/inventario": bajoMinimo,
    "/compras": comprasPendientes,
  };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const badges = await loadSidebarBadges();
  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar badges={badges} />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">{children}</main>
      </div>
    </div>
  );
}
