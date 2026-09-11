import { NextRequest, NextResponse } from "next/server";
import { addQuote, getQuotes } from "@/lib/data-store";
import { generateId, generateQuoteNumber } from "@/lib/id";
import { calculateQuote } from "@/lib/quote-engine";
import type { Quote, QuoteInput } from "@/lib/types";

export async function GET() {
  return NextResponse.json(getQuotes());
}

export async function POST(req: NextRequest) {
  const input = (await req.json()) as QuoteInput;
  try {
    const result = calculateQuote(input);
    const quote: Quote = {
      id: generateId("q"),
      quoteNumber: generateQuoteNumber(getQuotes().length, new Date(input.quoteDate)),
      createdAt: new Date().toISOString(),
      input,
      result,
    };
    addQuote(quote);
    return NextResponse.json(quote, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create quote";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
