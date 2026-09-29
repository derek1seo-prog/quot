import { NextRequest, NextResponse } from "next/server";
import {
  getChargeRates,
  getChargeTypes,
  getContainerTypes,
  getCountries,
  getCurrentExchangeRate,
  getCustomers,
  getOceanFreightRates,
  getPorts,
  getRegions,
  getSalesReps,
} from "@/lib/data-store";
import { requireAdmin } from "@/lib/session";

// Everything the admin "new quote" wizard needs in one round trip -
// includes the full customer list and raw rate sheets, so this is
// admin-only (guest/customer use /api/calculate instead, which only ever
// returns a computed result, never the underlying rate sheet or other
// customers' data).
export async function GET(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;

  const [oceanFreightRates, chargeRates, exchangeRate, customers, salesReps] = await Promise.all([
    getOceanFreightRates(),
    getChargeRates(),
    getCurrentExchangeRate("USD"),
    getCustomers(),
    getSalesReps(),
  ]);
  return NextResponse.json({
    countries: getCountries(),
    regions: getRegions(),
    ports: getPorts(),
    containerTypes: getContainerTypes(),
    chargeTypes: getChargeTypes(),
    oceanFreightRates,
    chargeRates,
    exchangeRate,
    customers,
    salesReps,
  });
}
