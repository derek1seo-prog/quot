import { AppShell } from "@/components/layout/AppShell";
import { portalNavSections } from "@/lib/nav";
import { getSession } from "@/lib/auth/require";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const roleLabel = session?.role === "customer" ? session.customerName : "화주";
  return (
    <AppShell sections={portalNavSections} homeHref="/portal" roleLabel={roleLabel}>
      {children}
    </AppShell>
  );
}
