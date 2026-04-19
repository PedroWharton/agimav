import {
  Truck,
  Package,
  ShoppingCart,
  Wrench,
  ClipboardList,
  BarChart3,
  List,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { href: "/maquinaria", labelKey: "nav.maquinaria", icon: Truck },
  { href: "/inventario", labelKey: "nav.inventario", icon: Package },
  { href: "/compras", labelKey: "nav.compras", icon: ShoppingCart },
  { href: "/mantenimiento", labelKey: "nav.mantenimiento", icon: Wrench },
  { href: "/ordenes-trabajo", labelKey: "nav.ordenesTrabajo", icon: ClipboardList },
  { href: "/estadisticas", labelKey: "nav.estadisticas", icon: BarChart3 },
  { href: "/listados", labelKey: "nav.listados", icon: List },
];
