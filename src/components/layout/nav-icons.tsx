import {
  Contact,
  FilePlus2,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Settings,
  Ship,
  Table2,
  Users,
  Zap,
} from "lucide-react";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { cn } from "@/lib/cn";
import type { NavItemDef } from "@/lib/nav";

export function NavIcon({
  icon,
  countryId,
  active = false,
  size = 17,
}: {
  icon: NavItemDef["icon"];
  countryId?: string;
  active?: boolean;
  size?: number;
}) {
  switch (icon) {
    case "dashboard":
      return <LayoutDashboard size={size} />;
    case "new-quote":
      return <FilePlus2 size={size} />;
    case "quote-list":
      return <ListChecks size={size} />;
    case "quick-quote":
      return <Zap size={size} />;
    case "region":
      // Muted at rest, full color on row hover or when active - the flag's
      // version of the gray->accent shift the line icons get (rows are `group`).
      return countryId ? (
        <CountryFlag
          countryId={countryId}
          size={size - 1}
          className={cn(
            "transition-[filter,opacity] duration-200",
            !active && "opacity-85 saturate-[.85] group-hover:opacity-100 group-hover:saturate-100",
          )}
        />
      ) : (
        <Ship size={size} />
      );
    case "customers":
      return <Users size={size} />;
    case "sales-reps":
      return <Contact size={size} />;
    case "settings":
      return <Settings size={size} />;
    case "rates":
      return <Table2 size={size} />;
    case "inquiries":
      return <Inbox size={size} />;
  }
}
