import { Sidebar, type SidebarBadges } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { prisma } from "@/lib/db";

async function loadSidebarBadges(): Promise<SidebarBadges> {
  const bajoMinimo = await prisma.inventario.count({
    where: { stockMinimo: { gt: 0 }, stock: { lt: prisma.inventario.fields.stockMinimo } },
  });
  return { "/inventario": bajoMinimo };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const badges = await loadSidebarBadges();
  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar badges={badges} />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
