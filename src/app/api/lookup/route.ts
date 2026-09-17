import { NextRequest, NextResponse } from "next/server";
import { getCustomerById } from "@/lib/data-store";
import { calculateQuote } from "@/lib/quote-engine";
import { getSession } from "@/lib/auth/require";
import type { LookupInput, QuoteInput } from "@/lib/types";

// Public rate-lookup calculator - shared by the logged-out landing page and
// the customer portal. Deliberately never trusts a client-supplied customer
// identity: the only way this calculation can be personalized (a customer's
// negotiated inland-trucking rate) is by deriving it from the caller's own
// verified session, never from the request body.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as LookupInput;
  const session = await getSession();

  let customerName = "";
  if (session?.role === "customer") {
    const customer = await getCustomerById(session.sub);
    customerName = customer?.name ?? "";
  }

  const today = new Date().toISOString().slice(0, 10);
  const input: QuoteInput = {
    customerName,
    preparedBy: "",
    quoteDate: today,
    validUntil: today,
    transportMode: body.transportMode,
    originCountryId: "",
    originPortId: body.originPortId,
    destinationCountryId: "",
    destinationPortId: body.destinationPortId,
    incoterms: body.incoterms,
    container: body.container,
  };

  try {
    const result = await calculateQuote(input);
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "계산에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
