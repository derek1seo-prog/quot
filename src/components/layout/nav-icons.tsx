import {
  FilePlus2,
  LayoutDashboard,
  ListChecks,
  Settings,
  Ship,
  Users,
} from "lucide-react";
import { countryFlag } from "@/lib/format";
import type { NavItemDef } from "@/lib/nav";

export function NavIcon({
  icon,
  countryId,
  size = 17,
}: {
  icon: NavItemDef["icon"];
  countryId?: string;
  size?: number;
}) {
  switch (icon) {
    case "dashboard":
      return <LayoutDashboard size={size} />;
    case "new-quote":
      return <FilePlus2 size={size} />;
    case "quote-list":
      return <ListChecks size={size} />;
    case "region":
      // A country's flag reads at a glance which region a rate page covers,
      // and scales to more countries automatically - no icon to pick or
      // maintain as Vietnam/Thailand's neighbors are added later.
      return countryId ? (
        <span style={{ fontSize: size }} role="img" aria-label={countryId}>
          {countryFlag(countryId)}
        </span>
      ) : (
        <Ship size={size} />
      );
    case "customers":
      return <Users size={size} />;
    case "settings":
      return <Settings size={size} />;
  }
}
