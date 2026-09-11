// Server-only JSON-file data store.
//
// This is the single access point for all reference data (regions, ports,
// container types, charge types, rates) and transactional data (quotes,
// customers). It is intentionally a thin file-backed repository rather than
// a real database so the MVP has zero external infra dependencies - the
// on-disk JSON files under src/data are the "admin editable" rate sheets
// described in the spec. Swapping this module for a Postgres/Prisma-backed
// one later does not require touching the calculation engine or UI, since
// everything reads through the functions below.
import fs from "node:fs";
import path from "node:path";
import type {
  ChargeRate,
  ChargeType,
  CompanyInfo,
  ContainerType,
  Country,
  Customer,
  ExchangeRate,
  OceanFreightRate,
  Port,
  Quote,
  Region,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "src", "data");

// Serverless platforms (Vercel, AWS Lambda, ...) ship the app on a read-only
// filesystem - only /tmp is writable, and it is wiped between cold starts
// and never shared across instances. In that environment we copy the seed
// JSON into /tmp on first read and read/write there from then on, so the
// app stays usable for a demo instead of throwing on every save. Locally
// (and on a normal long-running Node server) we keep reading/writing
// src/data directly so admin edits persist to the repo like before.
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const WRITABLE_DIR = IS_SERVERLESS ? path.join("/tmp", "quot-data") : DATA_DIR;

function ensureSeeded(file: string): string {
  const target = path.join(WRITABLE_DIR, file);
  if (IS_SERVERLESS && !fs.existsSync(target)) {
    fs.mkdirSync(WRITABLE_DIR, { recursive: true });
    fs.copyFileSync(path.join(DATA_DIR, file), target);
  }
  return target;
}

function readJson<T>(file: string): T {
  const filePath = ensureSeeded(file);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

function writeJson<T>(file: string, data: T): void {
  const filePath = ensureSeeded(file);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// ---------- Reference data (read) ----------

export function getCountries(): Country[] {
  return readJson<Country[]>("countries.json");
}

export function getRegions(): Region[] {
  return readJson<Region[]>("regions.json");
}

export function getRegionById(id: string): Region | undefined {
  return getRegions().find((r) => r.id === id);
}

export function getPorts(): Port[] {
  return readJson<Port[]>("ports.json");
}

export function getPortById(id: string): Port | undefined {
  return getPorts().find((p) => p.id === id);
}

export function getContainerTypes(): ContainerType[] {
  return readJson<ContainerType[]>("container-types.json").sort(
    (a, b) => a.order - b.order,
  );
}

export function getChargeTypes(): ChargeType[] {
  return readJson<ChargeType[]>("charge-types.json").sort(
    (a, b) => a.order - b.order,
  );
}

export function getOceanFreightRates(): OceanFreightRate[] {
  return readJson<OceanFreightRate[]>("ocean-freight-rates.json");
}

export function getChargeRates(): ChargeRate[] {
  return readJson<ChargeRate[]>("charge-rates.json");
}

export function getExchangeRates(): ExchangeRate[] {
  return readJson<ExchangeRate[]>("exchange-rates.json");
}

export function getCurrentExchangeRate(currency: string): ExchangeRate | undefined {
  return getExchangeRates().find((e) => e.currency === currency);
}

export function getCompany(): CompanyInfo {
  return readJson<CompanyInfo>("company.json");
}

export function getCustomers(): Customer[] {
  return readJson<Customer[]>("customers.json");
}

export function getQuotes(): Quote[] {
  return readJson<Quote[]>("quotes.json");
}

export function getQuoteById(id: string): Quote | undefined {
  return getQuotes().find((q) => q.id === id);
}

// ---------- Writes (admin rate management + quote persistence) ----------

export function upsertOceanFreightRate(rate: OceanFreightRate): void {
  const rates = getOceanFreightRates();
  const idx = rates.findIndex((r) => r.id === rate.id);
  if (idx >= 0) rates[idx] = rate;
  else rates.push(rate);
  writeJson("ocean-freight-rates.json", rates);
}

export function upsertChargeRate(rate: ChargeRate): void {
  const rates = getChargeRates();
  const idx = rates.findIndex((r) => r.id === rate.id);
  if (idx >= 0) rates[idx] = rate;
  else rates.push(rate);
  writeJson("charge-rates.json", rates);
}

export function upsertExchangeRate(rate: ExchangeRate): void {
  const rates = getExchangeRates();
  const idx = rates.findIndex((r) => r.currency === rate.currency);
  if (idx >= 0) rates[idx] = rate;
  else rates.push(rate);
  writeJson("exchange-rates.json", rates);
}

export function addCustomer(customer: Customer): void {
  const customers = getCustomers();
  customers.push(customer);
  writeJson("customers.json", customers);
}

export function addQuote(quote: Quote): void {
  const quotes = getQuotes();
  quotes.unshift(quote);
  writeJson("quotes.json", quotes);
}

export function deleteQuote(id: string): void {
  const quotes = getQuotes().filter((q) => q.id !== id);
  writeJson("quotes.json", quotes);
}
