import { NextRequest, NextResponse } from "next/server";
import { calculateQuote } from "@/lib/quote-engine";
import { requireAdmin } from "@/lib/auth/require";
import type { QuoteInput } from "@/lib/types";

// Internal wizard preview - trusts the full QuoteInput including
// customerName, so it stays admin-only. Public/customer-facing lookups go
// through POST /api/lookup instead, which never trusts a client-supplied
// identity.
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const input = (await req.json()) as QuoteInput;
  try {
    const result = await calculateQuote(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Calculation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
