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
  getRegions,
} from "./data-store";
import type {
  ChargeCatalogEntry,
  ChargeType,
  ContainerSelection,
  CustomCharge,
  Customer,
  QuoteColumn,
  QuoteInput,
  QuoteLineItem,
  QuoteResult,
} from "./types";
import { CUSTOM_CHARGE_PREFIX } from "./custom-charges";
import { VAT_APPLICABLE_CHARGE_TYPE_IDS, VAT_RATE } from "./vat";

const INLAND_TRUCKING_CHARGE_TYPE_ID = "INLAND_TRUCKING";
const EXW_LOCAL_CHARGE_TYPE_ID = "EXW_LOCAL_CHARGE";
export const LSS_CHARGE_TYPE_ID = "LSS";

/** Customer-specific inland trucking rate for a destination port + container type, if on file. */
function getTruckingRate(
  customer: Customer,
  prefix: "incheon" | "busan" | "pyeongtaek",
  containerTypeId: string,
): number | undefined {
  if (containerTypeId === "20ft") {
    return prefix === "incheon"
      ? customer.incheonTruckingRate20ft
      : prefix === "busan"
        ? customer.busanTruckingRate20ft
        : customer.pyeongtaekTruckingRate20ft;
  }
  if (containerTypeId === "40hq") {
    return prefix === "incheon"
      ? customer.incheonTruckingRate40hq
      : prefix === "busan"
        ? customer.busanTruckingRate40hq
        : customer.pyeongtaekTruckingRate40hq;
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
    // EXW LOCAL CHARGE has no registered rate sheet entry - it varies every
    // shipment, so it's never listed here for an admin to pre-register.
    .filter((ct) => ct.id !== EXW_LOCAL_CHARGE_TYPE_ID)
    .filter((ct) => chargeAppliesToRegion(ct, regionId));
}

/** Regions whose rate sheet has an LSS line - where "FOB + LSS" does anything. */
export function getLssRegionIds(): string[] {
  const lss = getChargeTypes().find((ct) => ct.id === LSS_CHARGE_TYPE_ID);
  if (!lss) return [];
  return lss.visibility.scope === "ALL" ? getRegions().map((r) => r.id) : lss.visibility.regionIds;
}

function round(n: number): number {
  return Math.round(n);
}

const MAX_CUSTOM_CHARGES = 30;

/** Request input is untrusted - keep only well-formed custom lines. */
function sanitizeCustomCharges(raw: unknown): CustomCharge[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is CustomCharge => typeof c === "object" && c !== null && typeof c.id === "string")
    .slice(0, MAX_CUSTOM_CHARGES)
    .map((c) => ({
      id: c.id.slice(0, 40),
      category: c.category === "EXW_LOCAL" ? ("EXW_LOCAL" as const) : ("LOCAL" as const),
      nameKo: typeof c.nameKo === "string" ? c.nameKo.trim().slice(0, 60) : "",
      currency: c.currency === "USD" ? ("USD" as const) : ("KRW" as const),
      rate: typeof c.rate === "number" && Number.isFinite(c.rate) && c.rate >= 0 ? c.rate : 0,
    }));
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
  const rateOverride = Number(input.exchangeRateOverride);
  const exchangeRate =
    Number.isFinite(rateOverride) && rateOverride > 0 ? rateOverride : (currentExchangeRate?.rate ?? 0);
  // Per-quote edits: standard charges removed from this quote (ocean
  // freight is never removable) and extra lines typed in by an admin.
  const excluded = new Set((input.excludedChargeTypeIds ?? []).filter((id) => id !== "OCEAN_FREIGHT"));
  const customCharges = sanitizeCustomCharges(input.customCharges);

  // Inland trucking is customer-specific (not region/rate-sheet driven like
  // every other charge), so it's resolved separately here. Per product
  // decision: only show it when the matched customer has a rate on file for
  // EVERY selected container type at the quote's destination port - an
  // incomplete set hides the row entirely rather than showing partial
  // "미등록" cells like the region-driven charges below do.
  const truckingPrefix: "incheon" | "busan" | "pyeongtaek" | null =
    input.destinationPortId === "incheon"
      ? "incheon"
      : input.destinationPortId === "busan"
        ? "busan"
        : input.destinationPortId === "pyeongtaek"
          ? "pyeongtaek"
          : null;
  const truckingRate =
    customer && truckingPrefix
      ? getTruckingRate(customer, truckingPrefix, input.container.containerTypeId)
      : undefined;
  const truckingComplete = truckingRate != null && !excluded.has(INLAND_TRUCKING_CHARGE_TYPE_ID);

  const containerTypes = getContainerTypes();
  const chargeTypes = getChargeTypes().filter((ct) =>
    ct.transportModes.includes(input.transportMode),
  );

  let applicableChargeTypes = chargeTypes
    .filter((ct) => ct.category !== "OCEAN_FREIGHT")
    // EXW_LOCAL charges (LSS, EXW LOCAL CHARGE) only apply when the quote's
    // own Incoterms is EXW - every other charge type here is filtered by
    // region/transport mode alone, this one by the quote itself.
    // ...or, for "FOB + LSS" quotes (input.includeLss), just the LSS line.
    .filter(
      (ct) =>
        ct.category !== "EXW_LOCAL" || input.incoterms === "EXW" || (input.includeLss === true && ct.id === LSS_CHARGE_TYPE_ID),
    )
    // EXW LOCAL CHARGE has no registered rate sheet entry (see
    // getApplicableLocalChargeTypes above) - it's resolved separately
    // below, the same way inland trucking bypasses this generic loop.
    .filter((ct) => ct.id !== EXW_LOCAL_CHARGE_TYPE_ID)
    .filter((ct) => chargeAppliesToRegion(ct, region.id))
    .filter((ct) => !excluded.has(ct.id));
  // ALL-IN: the region's surcharges (BAF/CAF/CRS, EBS/CRS, ...) aren't
  // listed - their 단가 is folded into the ocean freight's instead.
  const allInSurcharges = input.allIn
    ? applicableChargeTypes.filter((ct) => ct.category === "SURCHARGE" && ct.unit === "CONTAINER")
    : [];
  if (allInSurcharges.length > 0) {
    applicableChargeTypes = applicableChargeTypes.filter((ct) => !allInSurcharges.includes(ct));
  }
  const baseOceanFreightChargeType = chargeTypes.find((ct) => ct.id === "OCEAN_FREIGHT");
  const oceanFreightChargeType =
    baseOceanFreightChargeType && input.allIn
      ? {
          ...baseOceanFreightChargeType,
          nameKo: "ALL-IN 운임",
          name:
            allInSurcharges.length > 0
              ? `${baseOceanFreightChargeType.name} (incl. ${allInSurcharges.map((ct) => ct.id.replace(/_SURCHARGE$/, "")).join(", ")})`
              : `${baseOceanFreightChargeType.name} (ALL-IN)`,
        }
      : baseOceanFreightChargeType;
  const exwLocalChargeType = excluded.has(EXW_LOCAL_CHARGE_TYPE_ID)
    ? undefined
    : chargeTypes.find((ct) => ct.id === EXW_LOCAL_CHARGE_TYPE_ID);

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
      // ALL-IN: rate sheet O/F + each folded surcharge (same currency). An
      // edited O/F 단가 is then the all-in figure itself.
      let allInRate = oceanFreight.rate;
      for (const ct of allInSurcharges) {
        const r = chargeRates.find(
          (cr) =>
            cr.regionId === region.id &&
            cr.chargeTypeId === ct.id &&
            cr.containerTypeId === selection.containerTypeId,
        );
        if (!r) {
          missingRate = true;
          continue;
        }
        const sr = input.rateOverrides?.[ct.id] ?? r.rate;
        if (r.currency === oceanFreight.currency) allInRate += sr;
        else if (r.currency === "USD") allInRate += sr * exchangeRate;
        else if (exchangeRate > 0) allInRate += sr / exchangeRate;
      }
      allInRate = Math.round(allInRate * 100) / 100;
      const rate = input.rateOverrides?.[oceanFreightChargeType.id] ?? allInRate;
      const base = rate * qty;
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
        rate,
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
      const effectiveRate = input.rateOverrides?.[chargeType.id] ?? rate.rate;
      const multiplier = chargeType.unit === "BL" ? 1 : qty;
      const base = effectiveRate * multiplier;
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
        rate: effectiveRate,
        vatRate: chargeType.vatRate,
        vatAmount:
          rate.currency === "KRW" ? vatAmount : round(vatAmount * exchangeRate),
        quantity: multiplier,
        amountForeign,
        amountKrw,
      });
    }

    // EXW LOCAL CHARGE has no registered rate sheet entry - it varies
    // every shipment, so it always starts at a $0 default and is edited
    // per-quote via rateOverrides, exactly like any other line's 단가 in
    // the wizard preview (see onRateChange in QuoteDocument.tsx).
    if (input.incoterms === "EXW" && exwLocalChargeType) {
      const rate = input.rateOverrides?.[exwLocalChargeType.id] ?? 0;
      lineItems.push({
        chargeTypeId: exwLocalChargeType.id,
        name: exwLocalChargeType.name,
        nameKo: exwLocalChargeType.nameKo,
        category: exwLocalChargeType.category,
        currency: "USD",
        unit: exwLocalChargeType.unit, // "BL" - flat once per shipment
        rate,
        vatRate: 0,
        vatAmount: 0,
        quantity: 1,
        amountForeign: rate,
        amountKrw: round(rate * exchangeRate),
      });
    }

    // Customer-specific inland trucking (see resolution above)
    if (truckingComplete) {
      const rate = input.rateOverrides?.[INLAND_TRUCKING_CHARGE_TYPE_ID] ?? truckingRate!;
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

    // Admin-typed extra lines (per container, no VAT)
    for (const c of customCharges) {
      const base = c.rate * qty;
      lineItems.push({
        chargeTypeId: `${CUSTOM_CHARGE_PREFIX}${c.id}`,
        name: "",
        nameKo: c.nameKo,
        category: c.category,
        currency: c.currency,
        unit: "CONTAINER",
        rate: c.rate,
        vatRate: 0,
        vatAmount: 0,
        quantity: qty,
        amountForeign: base,
        amountKrw: c.currency === "KRW" ? base : round(base * exchangeRate),
      });
    }

    const oceanFreightSubtotalKrw = lineItems
      .filter((li) => li.category === "OCEAN_FREIGHT")
      .reduce((sum, li) => sum + li.amountKrw, 0);
    const localSubtotalKrw = lineItems
      .filter((li) => li.category !== "OCEAN_FREIGHT")
      .reduce((sum, li) => sum + li.amountKrw, 0);
    const vatKrw = input.vatIncluded
      ? round(
          lineItems
            .filter((li) => VAT_APPLICABLE_CHARGE_TYPE_IDS.has(li.chargeTypeId))
            .reduce((sum, li) => sum + li.amountKrw, 0) * VAT_RATE,
        )
      : undefined;

    return {
      containerTypeId: selection.containerTypeId,
      containerLabel: label,
      quantity: qty,
      lineItems,
      oceanFreightSubtotalKrw,
      localSubtotalKrw,
      grandTotalKrw: oceanFreightSubtotalKrw + localSubtotalKrw + (vatKrw ?? 0),
      ...(vatKrw !== undefined && { vatKrw }),
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
    ...(input.incoterms === "EXW" && exwLocalChargeType
      ? [
          {
            chargeTypeId: exwLocalChargeType.id,
            name: exwLocalChargeType.name,
            nameKo: exwLocalChargeType.nameKo,
            category: exwLocalChargeType.category,
            unit: exwLocalChargeType.unit,
          },
        ]
      : []),
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
    ...customCharges.map((c) => ({
      chargeTypeId: `${CUSTOM_CHARGE_PREFIX}${c.id}`,
      name: "",
      nameKo: c.nameKo,
      category: c.category,
      unit: "CONTAINER" as const,
    })),
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
