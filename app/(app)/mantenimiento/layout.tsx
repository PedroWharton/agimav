import { MantenimientoSubnav } from "./subnav";

export default function MantenimientoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MantenimientoSubnav />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
