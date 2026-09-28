import { NextRequest, NextResponse } from "next/server";
import { getCustomerById } from "@/lib/data-store";
import { calculateQuote } from "@/lib/quote-engine";
import { getSessionFromRequest } from "@/lib/session";
import type { QuoteInput } from "@/lib/types";

export async function POST(req: NextRequest) {
  const input = (await req.json()) as QuoteInput;
  const session = getSessionFromRequest(req);

  // customerName drives calculateQuote's customer-specific trucking-rate
  // lookup (see quote-engine.ts), so it's the one field that actually
  // matters for calculation - force it server-side per role rather than
  // trusting whatever a client sent, so a guest/customer session can never
  // fish for another customer's negotiated rate by probing names.
  if (session?.role === "guest") {
    input.customerName = "";
  } else if (session?.role === "customer") {
    const customer = session.customerId ? await getCustomerById(session.customerId) : undefined;
    input.customerName = customer?.name ?? "";
  }

  try {
    const result = await calculateQuote(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Calculation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
