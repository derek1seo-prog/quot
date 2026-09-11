import {
  FilePlus2,
  LayoutDashboard,
  ListChecks,
  Settings,
  Ship,
  Users,
} from "lucide-react";
import type { NavItemDef } from "@/lib/nav";

export function NavIcon({ icon, size = 17 }: { icon: NavItemDef["icon"]; size?: number }) {
  switch (icon) {
    case "dashboard":
      return <LayoutDashboard size={size} />;
    case "new-quote":
      return <FilePlus2 size={size} />;
    case "quote-list":
      return <ListChecks size={size} />;
    case "region":
      return <Ship size={size} />;
    case "customers":
      return <Users size={size} />;
    case "settings":
      return <Settings size={size} />;
  }
}
