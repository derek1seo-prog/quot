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
  return <UnlockForm next={next && next.startsWith("/") ? next : "/"} />;
}
