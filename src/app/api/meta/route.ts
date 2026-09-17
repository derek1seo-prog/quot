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
import { requireAdmin } from "@/lib/auth/require";

// Everything the internal "new quote" wizard needs in one round trip -
// admin-only since it includes the full customer list. Public/customer
// lookup uses GET /api/meta/public instead.
export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const [oceanFreightRates, chargeRates, exchangeRate, customers] = await Promise.all([
    getOceanFreightRates(),
    getChargeRates(),
    getCurrentExchangeRate("USD"),
    getCustomers(),
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
    // passwordHash must never reach a client, even the admin's own browser.
    customers: customers.map((c) => {
      const { passwordHash, ...rest } = c;
      return passwordHash ? rest : c;
    }),
  });
}
