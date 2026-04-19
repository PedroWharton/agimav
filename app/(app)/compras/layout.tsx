import { ComprasSubnav } from "./subnav";

export default function ComprasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ComprasSubnav />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
