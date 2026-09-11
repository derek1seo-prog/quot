import { NextResponse } from "next/server";
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
} from "@/lib/data-store";

// Everything the "new quote" wizard needs in one round trip.
export async function GET() {
  return NextResponse.json({
    countries: getCountries(),
    regions: getRegions(),
    ports: getPorts(),
    containerTypes: getContainerTypes(),
    chargeTypes: getChargeTypes(),
    oceanFreightRates: getOceanFreightRates(),
    chargeRates: getChargeRates(),
    exchangeRate: getCurrentExchangeRate("USD"),
    customers: getCustomers(),
  });
}
