import { NextRequest, NextResponse } from "next/server";
import { calculateQuote } from "@/lib/quote-engine";
import type { QuoteInput } from "@/lib/types";

export async function POST(req: NextRequest) {
  const input = (await req.json()) as QuoteInput;
  try {
    const result = calculateQuote(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Calculation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
