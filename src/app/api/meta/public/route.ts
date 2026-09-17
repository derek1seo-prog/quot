import { NextResponse } from "next/server";
import { getContainerTypes, getPorts, getRegions } from "@/lib/data-store";

// Public/customer-safe subset of /api/meta - no customers, no rate tables
// (rates are resolved server-side inside /api/lookup, never shipped raw).
export async function GET() {
  return NextResponse.json({
    regions: getRegions(),
    ports: getPorts(),
    containerTypes: getContainerTypes(),
  });
}
