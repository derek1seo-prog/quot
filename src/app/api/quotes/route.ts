import { NextRequest, NextResponse } from "next/server";
import { addQuote, getCustomerById, getQuotes } from "@/lib/data-store";
import { generateId, generateQuoteNumber } from "@/lib/id";
import { calculateQuote } from "@/lib/quote-engine";
import { getSessionFromRequest } from "@/lib/session";
import { CUSTOMER_QUOTE_PREPARED_BY } from "@/lib/customer-portal";
import type { Quote, QuoteInput } from "@/lib/types";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (session?.role === "guest") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const quotes = await getQuotes();
  if (session?.role === "customer") {
    return NextResponse.json(quotes.filter((q) => q.input.customerId === session.customerId));
  }
  return NextResponse.json(quotes);
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (session?.role === "guest") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const input = (await req.json()) as QuoteInput;

  // A customer session can freely change lookup conditions (route,
  // incoterms, container) but never the identity/ownership fields - those
  // are overwritten server-side from the session's own matched customer
  // record, discarding whatever the request body says for them. This is
  // the actual enforcement of "화주가 임의로 화주명/담당자/기본 정보를 수정할
  // 수 없도록" - not a client-side convention.
  if (session?.role === "customer") {
    const customer = session.customerId ? await getCustomerById(session.customerId) : undefined;
    if (!customer) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    input.customerId = customer.id;
    input.customerName = customer.name;
    input.contactName = customer.contactName;
    input.preparedBy = CUSTOMER_QUOTE_PREPARED_BY;
    input.rateOverrides = undefined;
  }

  try {
    const [result, existingQuotes] = await Promise.all([calculateQuote(input), getQuotes()]);
    const quote: Quote = {
      id: generateId("q"),
      quoteNumber: generateQuoteNumber(existingQuotes.length, new Date(input.quoteDate)),
      createdAt: new Date().toISOString(),
      input,
      result,
    };
    await addQuote(quote);
    return NextResponse.json(quote, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create quote";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
