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

export type NavSection = {
  id: "operacion" | "analisis" | "datos-maestros";
  label: string;
  items: NavItem[];
};

export const NAV: NavSection[] = [
  {
    id: "operacion",
    label: "Operación",
    items: [
      { href: "/maquinaria", labelKey: "nav.maquinaria", icon: Truck },
      { href: "/inventario", labelKey: "nav.inventario", icon: Package },
      { href: "/compras", labelKey: "nav.compras", icon: ShoppingCart },
      { href: "/mantenimiento", labelKey: "nav.mantenimiento", icon: Wrench },
      {
        href: "/ordenes-trabajo",
        labelKey: "nav.ordenesTrabajo",
        icon: ClipboardList,
      },
    ],
  },
  {
    id: "analisis",
    label: "Análisis",
    items: [
      { href: "/estadisticas", labelKey: "nav.estadisticas", icon: BarChart3 },
    ],
  },
  {
    id: "datos-maestros",
    label: "Datos maestros",
    items: [{ href: "/listados", labelKey: "nav.listados", icon: List }],
  },
];

// Backwards-compatible flat list for consumers that iterate nav items directly
// (e.g. sidebar/breadcrumbs pre-redesign). New code should prefer `NAV`.
export const NAV_FLAT: NavItem[] = NAV.flatMap((s) => s.items);

/** @deprecated Use `NAV_FLAT` or `NAV`. Kept for backwards compatibility. */
export const navItems: NavItem[] = NAV_FLAT;
