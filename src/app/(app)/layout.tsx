import { AppShell } from "@/components/layout/AppShell";
import { getCompany } from "@/lib/data-store";
import { decodeSessionCookie } from "@/lib/session";
import { cookies } from "next/headers";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = decodeSessionCookie(cookieStore);
  // proxy.ts guarantees a valid session reaches every page under this
  // group, so this fallback should never actually trigger - but if it
  // somehow did, fail closed (least-privileged nav) rather than open.
  const company = getCompany();
  return (
    <AppShell role={session?.role ?? "guest"} companyName={company.nameKo ?? company.name}>
      {children}
    </AppShell>
  );
}
