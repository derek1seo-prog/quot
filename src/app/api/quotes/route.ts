import { NextRequest, NextResponse } from "next/server";
import { addQuote, getQuotes } from "@/lib/data-store";
import { generateId, generateQuoteNumber } from "@/lib/id";
import { calculateQuote } from "@/lib/quote-engine";
import { requireAdmin } from "@/lib/auth/require";
import type { Quote, QuoteInput } from "@/lib/types";

export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;
  return NextResponse.json(await getQuotes());
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const input = (await req.json()) as QuoteInput;
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
