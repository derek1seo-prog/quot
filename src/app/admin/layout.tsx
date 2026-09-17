import { AppShell } from "@/components/layout/AppShell";
import { adminNavSections } from "@/lib/nav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell sections={adminNavSections} homeHref="/admin" roleLabel="관리자">
      {children}
    </AppShell>
  );
}
