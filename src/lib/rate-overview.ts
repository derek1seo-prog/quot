import { getContainerTypes, getPorts } from "./data-store";
import { todayIso } from "./format";
import { calculateQuote } from "./quote-engine";
import type { Port } from "./types";

// Same three Korea-side destinations the admin's own Ocean Freight table
// (RegionRatesEditor.tsx) already uses - kept in sync manually since both
// are a small, stable, hand-maintained list of real destination ports.
const OVERVIEW_DESTINATIONS = ["incheon", "busan", "pyeongtaek"] as const;

const TODAY = todayIso();

export interface RateOverviewCell {
  destinationPortId: string;
  containerTypeId: string;
  /** null = 미등록 (no ocean freight rate registered for this lane yet) */
  oceanFreightUsd: number | null;
  oceanFreightSubtotalKrw: number | null;
  localSubtotalKrw: number | null;
  grandTotalKrw: number | null;
}

export interface RateOverviewRow {
  port: Port; // origin port
  cells: RateOverviewCell[];
}

/** Builds a read-only "what would this lane roughly cost today" table for
 * every origin port in a region, reusing calculateQuote() - the exact same
 * engine every quote in this app already goes through - rather than
 * re-deriving charge totals by hand. customerName is always blank (no
 * trucking-rate match, same safe default already used for anonymous
 * quick-quote lookups) and Incoterms is fixed to FOB, since this is a
 * general reference sheet, not any one customer's or shipment's quote. */
export async function getRateOverviewByRegion(regionId: string): Promise<RateOverviewRow[]> {
  const ports = getPorts();
  const originPorts = ports.filter((p) => p.regionId === regionId && p.role !== "DESTINATION");
  const containerTypes = getContainerTypes();

  return Promise.all(
    originPorts.map(async (port) => {
      const cells = await Promise.all(
        OVERVIEW_DESTINATIONS.flatMap((destinationPortId) =>
          containerTypes.map(async (ct): Promise<RateOverviewCell> => {
            const destinationPort = ports.find((p) => p.id === destinationPortId);
            const result = await calculateQuote({
              customerName: "",
              preparedBy: "",
              quoteDate: TODAY,
              validUntil: TODAY,
              transportMode: "FCL",
              originCountryId: port.countryId,
              originPortId: port.id,
              destinationCountryId: destinationPort?.countryId ?? "",
              destinationPortId,
              incoterms: "FOB",
              container: { containerTypeId: ct.id, quantity: 1 },
            });
            const missing = result.column.missingRate;
            const oceanFreightItem = result.column.lineItems.find(
              (li) => li.chargeTypeId === "OCEAN_FREIGHT",
            );
            return {
              destinationPortId,
              containerTypeId: ct.id,
              oceanFreightUsd: missing ? null : (oceanFreightItem?.rate ?? null),
              oceanFreightSubtotalKrw: missing ? null : result.column.oceanFreightSubtotalKrw,
              localSubtotalKrw: missing ? null : result.column.localSubtotalKrw,
              grandTotalKrw: missing ? null : result.column.grandTotalKrw,
            };
          }),
        ),
      );
      return { port, cells };
    }),
  );
}
