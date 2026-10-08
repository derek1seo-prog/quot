import { UnlockForm } from "@/components/unlock/UnlockForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "잠금 해제 | I.S. Sea & Air",
};

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Admins land on 빠른 견적 by default rather than the dashboard ("/");
  // an explicit next (e.g. a protected page that bounced here) still wins.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") && next !== "/" ? next : null;
  return <UnlockForm next={safeNext ?? "/quick-quote"} />;
}
