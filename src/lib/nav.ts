export interface NavItemDef {
  href: string;
  label: string;
  icon: "dashboard" | "new-quote" | "quote-list" | "region" | "customers" | "settings";
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
      { href: "/rates/north-china", label: "북중국", icon: "region" },
      { href: "/rates/south-china", label: "남중국", icon: "region" },
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
