import { QuickQuoteScreen } from "@/components/quote/QuickQuoteScreen";
import { decodeSessionCookie } from "@/lib/session";
import { cookies } from "next/headers";

export default async function QuickQuotePage() {
  const session = decodeSessionCookie(await cookies());
  return <QuickQuoteScreen isAdmin={session?.role === "admin"} />;
}
