export interface NavItemDef {
  href: string;
  label: string;
  icon: "dashboard" | "new-quote" | "quote-list" | "region" | "customers" | "settings" | "compare" | "lookup";
}

export interface NavSectionDef {
  title?: string;
  items: NavItemDef[];
}

export const adminNavSections: NavSectionDef[] = [
  {
    items: [{ href: "/admin", label: "Dashboard", icon: "dashboard" }],
  },
  {
    title: "견적 관리",
    items: [
      { href: "/admin/quotes/new", label: "새 견적 만들기", icon: "new-quote" },
      { href: "/admin/quotes", label: "견적 목록", icon: "quote-list" },
    ],
  },
  {
    title: "요율 관리",
    items: [
      { href: "/admin/rates/north-china", label: "북중국", icon: "region" },
      { href: "/admin/rates/south-china", label: "남중국", icon: "region" },
      { href: "/admin/rates/vietnam", label: "베트남", icon: "region" },
      { href: "/admin/rates/thailand", label: "태국", icon: "region" },
    ],
  },
  {
    title: "관리",
    items: [
      { href: "/admin/customers", label: "고객 관리", icon: "customers" },
      { href: "/admin/settings", label: "설정", icon: "settings" },
    ],
  },
];

export const portalNavSections: NavSectionDef[] = [
  { items: [{ href: "/portal", label: "내 견적", icon: "quote-list" }] },
  { items: [{ href: "/portal/compare", label: "견적 비교", icon: "compare" }] },
  { items: [{ href: "/portal/lookup", label: "운임 조회", icon: "lookup" }] },
];

// Picks the single nav item that should read as "active" for a given
// pathname. A pathname can match more than one item's href as a prefix
// (e.g. "/admin/quotes/new" starts with both "/admin/quotes/new" and
// "/admin/quotes"), so among all matches we keep the most specific
// (longest) href. Takes the section list explicitly so it can score
// against whichever nav (admin or portal) the caller passed in.
export function getActiveHref(pathname: string, sections: NavSectionDef[]): string | undefined {
  const matches = sections
    .flatMap((section) => section.items)
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
