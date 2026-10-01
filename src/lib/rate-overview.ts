import { getContainerTypes, getDestinationPorts, getPorts } from "./data-store";
import { todayIso } from "./format";
import { calculateQuote } from "./quote-engine";
import type { Port } from "./types";

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
  const destinationPortIds = getDestinationPorts().map((p) => p.id);

  return Promise.all(
    originPorts.map(async (port) => {
      const cells = await Promise.all(
        destinationPortIds.flatMap((destinationPortId) =>
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
