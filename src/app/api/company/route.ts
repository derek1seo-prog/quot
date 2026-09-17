import { NextResponse } from "next/server";
import { getCompany } from "@/lib/data-store";

// Public: just the company's own public contact info (name/address/tel/
// email) for the letterhead - used by the admin wizard AND the public/
// customer rate-lookup result (which reuses QuoteDocument's letterhead).
// Nothing customer- or rate-specific lives here.
export async function GET() {
  return NextResponse.json(getCompany());
}
