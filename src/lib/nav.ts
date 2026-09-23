export interface NavItemDef {
  href: string;
  label: string;
  icon: "dashboard" | "new-quote" | "quote-list" | "region" | "customers" | "settings";
  /** ISO-ish country code (Country.id, e.g. "CN") for icon: "region" items -
   * rendered as that country's flag instead of a generic icon, since 요율
   * 관리 already groups regions by country and more countries keep getting
   * added there. */
  countryId?: string;
}

export interface NavSectionDef {
  title?: string;
  items: NavItemDef[];
}

export const navSections: NavSectionDef[] = [
  {
    items: [{ href: "/", label: "Dashboard", icon: "dashboard" }],
  },
  {
    title: "견적 관리",
    items: [
      { href: "/quotes/new", label: "새 견적 만들기", icon: "new-quote" },
      { href: "/quotes", label: "견적 목록", icon: "quote-list" },
    ],
  },
  {
    title: "요율 관리",
    items: [
      { href: "/rates/north-china", label: "북중국", icon: "region", countryId: "CN" },
      { href: "/rates/south-china", label: "남중국", icon: "region", countryId: "CN" },
      { href: "/rates/vietnam", label: "베트남", icon: "region", countryId: "VN" },
      { href: "/rates/thailand", label: "태국", icon: "region", countryId: "TH" },
    ],
  },
  {
    title: "관리",
    items: [
      { href: "/customers", label: "고객 관리", icon: "customers" },
      { href: "/settings", label: "설정", icon: "settings" },
    ],
  },
];

// Picks the single nav item that should read as "active" for a given
// pathname. A pathname can match more than one item's href as a prefix
// (e.g. "/quotes/new" starts with both "/quotes/new" and "/quotes"), so
// among all matches we keep the most specific (longest) href.
export function getActiveHref(pathname: string): string | undefined {
  const matches = navSections
    .flatMap((section) => section.items)
    .filter((item) =>
      item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/"),
    );
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
