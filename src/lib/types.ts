// Core domain types for the forwarding quote system.
// Everything here is designed to be data-driven: regions, ports, container
// types and charges are records, not code branches, so new lanes (Vietnam,
// LCL, air freight, ...) can be added later by adding data, not by editing
// the calculation engine.

export type TransportMode = "FCL" | "LCL" | "AIR";

export type Currency = "USD" | "KRW" | "CNY";

/** Unit a rate is quoted per. CONTAINER = per selected container, BL = flat once per shipment. */
export type RateUnit = "CONTAINER" | "BL";

export type ChargeCategory = "OCEAN_FREIGHT" | "SURCHARGE" | "LOCAL";

/**
 * Which regions a charge type shows up in.
 * "ALL" charges appear for every region (THC, wharfage, CRS, ...).
 * "REGION_SPECIFIC" charges only appear for the regions listed (BAF/CAF for
 * North China, EBS for South China).
 */
export type ChargeVisibility =
  | { scope: "ALL" }
  | { scope: "REGION_SPECIFIC"; regionIds: string[] };

export interface Country {
  id: string; // ISO-ish code, e.g. "CN", "KR", "VN"
  name: string;
  nameKo: string;
}

export interface Region {
  id: string;
  countryId: string;
  name: string; // e.g. "North & East China"
  nameKo: string; // e.g. "북중국"
  description?: string;
}

export interface Port {
  id: string;
  regionId: string | null; // null for destination-only ports not grouped by region
  countryId: string;
  name: string;
  nameKo: string;
  code: string; // UN/LOCODE, e.g. "CNTAO"
  role: "ORIGIN" | "DESTINATION" | "BOTH";
}

export interface ContainerType {
  id: string; // "20ft" | "40hq"
  label: string; // "20FT"
  excelCode: string; // "20GP" - kept for traceability back to source rate sheet
  order: number;
}

export interface ChargeType {
  id: string; // "OCEAN_FREIGHT" | "BAF" | "CAF" | "CRS" | "EBS" | "THC" | ...
  name: string;
  nameKo: string;
  category: ChargeCategory;
  unit: RateUnit;
  vatRate: number; // 0 or 0.1 (10% KR VAT)
  visibility: ChargeVisibility;
  order: number;
  transportModes: TransportMode[]; // which modes this charge applies to
}

/** Ocean freight is keyed by (portId, containerTypeId) - it is lane specific. */
export interface OceanFreightRate {
  id: string;
  portId: string;
  containerTypeId: string;
  currency: Currency;
  rate: number;
  effectiveFrom: string; // ISO date
  effectiveTo: string | null;
  updatedAt: string;
}

/**
 * Surcharges and local charges are keyed by (regionId, chargeTypeId, containerTypeId).
 * Regions carry the rate, not individual ports - matching the source rate
 * sheets, which are organised one sheet per region.
 */
export interface ChargeRate {
  id: string;
  regionId: string;
  chargeTypeId: string;
  containerTypeId: string;
  currency: Currency;
  rate: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  updatedAt: string;
}

export interface ExchangeRate {
  id: string;
  currency: Currency; // foreign currency, e.g. USD
  base: "KRW";
  rate: number; // 1 unit of `currency` = `rate` KRW
  asOf: string;
  updatedAt: string;
}

export interface CompanyInfo {
  name: string;
  nameKo?: string;
  addressLines: string[];
  tel: string;
  fax?: string;
  email: string;
  website?: string;
  sealText?: string; // signature line at the bottom of the quote letter
}

export interface Customer {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  incotermsDefault?: string;
  incheonTruckingRate20ft?: number; // KRW
  incheonTruckingRate40hq?: number; // KRW
  busanTruckingRate20ft?: number; // KRW
  busanTruckingRate40hq?: number; // KRW
  createdAt: string;
}

/** One line the user picks in the "container" step, with a quantity. */
export interface ContainerSelection {
  containerTypeId: string;
  quantity: number;
}

export interface QuoteInput {
  customerName: string;
  contactName?: string;
  preparedBy: string;
  quoteDate: string; // ISO date
  validUntil: string; // ISO date
  transportMode: TransportMode;
  originCountryId: string;
  originPortId: string;
  destinationCountryId: string;
  destinationPortId: string;
  incoterms: string;
  hsCode?: string;
  container: ContainerSelection;
  exchangeRateOverride?: number; // if omitted, use current stored exchange rate
  remarks?: string;
}

export interface QuoteLineItem {
  chargeTypeId: string;
  name: string;
  nameKo: string;
  category: ChargeCategory;
  currency: Currency;
  unit: RateUnit;
  rate: number;
  vatRate: number;
  vatAmount: number;
  quantity: number;
  amountForeign: number; // rate*qty + vat, in original currency
  amountKrw: number; // converted to KRW
}

export interface QuoteColumn {
  containerTypeId: string;
  containerLabel: string;
  quantity: number;
  lineItems: QuoteLineItem[];
  oceanFreightSubtotalKrw: number;
  localSubtotalKrw: number;
  grandTotalKrw: number;
  missingRate: boolean; // true if ocean freight rate not yet configured
}

export interface ChargeCatalogEntry {
  chargeTypeId: string;
  name: string;
  nameKo: string;
  category: ChargeCategory;
  unit: RateUnit;
}

export interface QuoteResult {
  regionId: string;
  regionNameKo: string;
  exchangeRate: number;
  exchangeRateCurrency: Currency;
  column: QuoteColumn;
  /** Canonical, ordered list of every charge row this region/mode can show - used to render a stable table even when a rate is missing. */
  chargeCatalog: ChargeCatalogEntry[];
}

export interface Quote {
  id: string;
  quoteNumber: string;
  createdAt: string;
  input: QuoteInput;
  result: QuoteResult;
}
