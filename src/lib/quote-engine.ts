// Data-driven quote calculation engine.
//
// No port, region or amount is hardcoded here - every number comes from the
// data store (src/data/*.json, editable by an admin without touching code).
// Adding a new region, port, container type or charge is purely a data
// change; this file only expresses *how* a quote is assembled from whatever
// data exists.
import {
  getChargeRates,
  getChargeTypes,
  getContainerTypes,
  getCurrentExchangeRate,
  getCustomerByName,
  getOceanFreightRates,
  getPortById,
  getRegionById,
} from "./data-store";
import type {
  ChargeCatalogEntry,
  ChargeType,
  ContainerSelection,
  Customer,
  QuoteColumn,
  QuoteInput,
  QuoteLineItem,
  QuoteResult,
} from "./types";

const INLAND_TRUCKING_CHARGE_TYPE_ID = "INLAND_TRUCKING";

/** Customer-specific inland trucking rate for a destination port + container type, if on file. */
function getTruckingRate(
  customer: Customer,
  prefix: "incheon" | "busan",
  containerTypeId: string,
): number | undefined {
  if (containerTypeId === "20ft") {
    return prefix === "incheon" ? customer.incheonTruckingRate20ft : customer.busanTruckingRate20ft;
  }
  if (containerTypeId === "40hq") {
    return prefix === "incheon" ? customer.incheonTruckingRate40hq : customer.busanTruckingRate40hq;
  }
  return undefined;
}

export function chargeAppliesToRegion(chargeType: ChargeType, regionId: string): boolean {
  if (chargeType.visibility.scope === "ALL") return true;
  return chargeType.visibility.regionIds.includes(regionId);
}

/** All non-ocean-freight charge types shown for a given region + transport mode, in display order. */
export function getApplicableLocalChargeTypes(
  regionId: string,
  transportMode: QuoteInput["transportMode"],
): ChargeType[] {
  return getChargeTypes()
    .filter((ct) => ct.transportModes.includes(transportMode))
    .filter((ct) => ct.category !== "OCEAN_FREIGHT")
    .filter((ct) => chargeAppliesToRegion(ct, regionId));
}

function round(n: number): number {
  return Math.round(n);
}

export async function calculateQuote(input: QuoteInput): Promise<QuoteResult> {
  const originPort = getPortById(input.originPortId);
  if (!originPort || !originPort.regionId) {
    throw new Error("Unknown or unsupported origin port for this transport mode.");
  }
  const region = getRegionById(originPort.regionId);
  if (!region) {
    throw new Error("Origin port is not assigned to a rate region.");
  }

  const [currentExchangeRate, oceanFreightRates, chargeRates, customer] = await Promise.all([
    getCurrentExchangeRate("USD"),
    getOceanFreightRates(),
    getChargeRates(),
    input.customerName ? getCustomerByName(input.customerName.trim()) : Promise.resolve(undefined),
  ]);
  const exchangeRate = input.exchangeRateOverride ?? currentExchangeRate?.rate ?? 0;

  // Inland trucking is customer-specific (not region/rate-sheet driven like
  // every other charge), so it's resolved separately here. Per product
  // decision: only show it when the matched customer has a rate on file for
  // EVERY selected container type at the quote's destination port - an
  // incomplete set hides the row entirely rather than showing partial
  // "미등록" cells like the region-driven charges below do.
  const truckingPrefix: "incheon" | "busan" | null =
    input.destinationPortId === "incheon"
      ? "incheon"
      : input.destinationPortId === "busan"
        ? "busan"
        : null;
  const truckingRate =
    customer && truckingPrefix
      ? getTruckingRate(customer, truckingPrefix, input.container.containerTypeId)
      : undefined;
  const truckingComplete = truckingRate != null;

  const containerTypes = getContainerTypes();
  const chargeTypes = getChargeTypes().filter((ct) =>
    ct.transportModes.includes(input.transportMode),
  );

  const applicableChargeTypes = chargeTypes
    .filter((ct) => ct.category !== "OCEAN_FREIGHT")
    .filter((ct) => chargeAppliesToRegion(ct, region.id));
  const oceanFreightChargeType = chargeTypes.find((ct) => ct.id === "OCEAN_FREIGHT");

  const selection: ContainerSelection = input.container;
  const column: QuoteColumn = (() => {
    const containerType = containerTypes.find((c) => c.id === selection.containerTypeId);
    const label = containerType?.label ?? selection.containerTypeId;
    const qty = Math.max(1, selection.quantity || 1);

    const lineItems: QuoteLineItem[] = [];
    let missingRate = false;

    // Ocean freight - origin port + destination port + container specific
    const oceanFreight = oceanFreightRates.find(
      (r) =>
        r.portId === originPort.id &&
        r.destinationPortId === input.destinationPortId &&
        r.containerTypeId === selection.containerTypeId,
    );
    if (!oceanFreight) {
      missingRate = true;
    } else if (oceanFreightChargeType) {
      const base = oceanFreight.rate * qty;
      const vatAmount = 0;
      const amountForeign = base + vatAmount;
      const amountKrw =
        oceanFreight.currency === "KRW" ? amountForeign : round(amountForeign * exchangeRate);
      lineItems.push({
        chargeTypeId: oceanFreightChargeType.id,
        name: oceanFreightChargeType.name,
        nameKo: oceanFreightChargeType.nameKo,
        category: oceanFreightChargeType.category,
        currency: oceanFreight.currency,
        unit: oceanFreightChargeType.unit,
        rate: oceanFreight.rate,
        vatRate: 0,
        vatAmount,
        quantity: qty,
        amountForeign,
        amountKrw,
      });
    }

    // Region-specific surcharges + common local charges
    for (const chargeType of applicableChargeTypes) {
      const rate = chargeRates.find(
        (r) =>
          r.regionId === region.id &&
          r.chargeTypeId === chargeType.id &&
          r.containerTypeId === selection.containerTypeId,
      );
      if (!rate) {
        missingRate = true;
        continue;
      }
      const multiplier = chargeType.unit === "BL" ? 1 : qty;
      const base = rate.rate * multiplier;
      const vatAmount = round(base * chargeType.vatRate);
      const amountForeign = base + vatAmount;
      const amountKrw =
        rate.currency === "KRW" ? amountForeign : round(amountForeign * exchangeRate);
      lineItems.push({
        chargeTypeId: chargeType.id,
        name: chargeType.name,
        nameKo: chargeType.nameKo,
        category: chargeType.category,
        currency: rate.currency,
        unit: chargeType.unit,
        rate: rate.rate,
        vatRate: chargeType.vatRate,
        vatAmount:
          rate.currency === "KRW" ? vatAmount : round(vatAmount * exchangeRate),
        quantity: multiplier,
        amountForeign,
        amountKrw,
      });
    }

    // Customer-specific inland trucking (see resolution above)
    if (truckingComplete) {
      const rate = truckingRate!;
      const base = rate * qty;
      lineItems.push({
        chargeTypeId: INLAND_TRUCKING_CHARGE_TYPE_ID,
        name: "Inland Trucking",
        nameKo: "내륙운송료",
        category: "LOCAL",
        currency: "KRW",
        unit: "CONTAINER",
        rate,
        vatRate: 0,
        vatAmount: 0,
        quantity: qty,
        amountForeign: base,
        amountKrw: base,
      });
    }

    const oceanFreightSubtotalKrw = lineItems
      .filter((li) => li.category === "OCEAN_FREIGHT")
      .reduce((sum, li) => sum + li.amountKrw, 0);
    const localSubtotalKrw = lineItems
      .filter((li) => li.category !== "OCEAN_FREIGHT")
      .reduce((sum, li) => sum + li.amountKrw, 0);

    return {
      containerTypeId: selection.containerTypeId,
      containerLabel: label,
      quantity: qty,
      lineItems,
      oceanFreightSubtotalKrw,
      localSubtotalKrw,
      grandTotalKrw: oceanFreightSubtotalKrw + localSubtotalKrw,
      missingRate,
    };
  })();

  const chargeCatalog: ChargeCatalogEntry[] = [
    ...(oceanFreightChargeType
      ? [
          {
            chargeTypeId: oceanFreightChargeType.id,
            name: oceanFreightChargeType.name,
            nameKo: oceanFreightChargeType.nameKo,
            category: oceanFreightChargeType.category,
            unit: oceanFreightChargeType.unit,
          },
        ]
      : []),
    ...applicableChargeTypes.map((ct) => ({
      chargeTypeId: ct.id,
      name: ct.name,
      nameKo: ct.nameKo,
      category: ct.category,
      unit: ct.unit,
    })),
    ...(truckingComplete
      ? [
          {
            chargeTypeId: INLAND_TRUCKING_CHARGE_TYPE_ID,
            name: "Inland Trucking",
            nameKo: "내륙운송료",
            category: "LOCAL" as const,
            unit: "CONTAINER" as const,
          },
        ]
      : []),
  ];

  return {
    regionId: region.id,
    regionNameKo: region.nameKo,
    exchangeRate,
    exchangeRateCurrency: "USD",
    column,
    chargeCatalog,
  };
}
