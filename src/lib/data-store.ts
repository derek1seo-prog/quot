// Data access layer.
//
// Reference data (regions, ports, container types, charge types, company
// info) is static - it ships with the app and is only ever read, so it is
// read straight from the bundled src/data/*.json files, synchronously.
//
// Mutable data (rates, customers, quotes) is what admins edit and what the
// quote wizard writes, so it needs real, cross-instance-consistent storage:
// on Vercel, every request can land on a different serverless instance with
// its own throwaway filesystem, so writing to a local JSON file (or even
// /tmp) is invisible to the very next request. When a Redis integration
// (Upstash for Redis via the Vercel Marketplace, or any other
// Upstash-compatible REST endpoint) is configured, we use that as the
// source of truth instead - one shared store every instance reads and
// writes. Locally, or anywhere without that env configured, we keep
// reading/writing the JSON files directly, unchanged from before.
import { Redis } from "@upstash/redis";
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

function readSeedJson<T>(file: string): T {
  const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
  return JSON.parse(raw) as T;
}

// ---------- Static reference data (bundled, read-only, always sync) ----------

export function getCountries(): Country[] {
  return readSeedJson<Country[]>("countries.json");
}

export function getRegions(): Region[] {
  return readSeedJson<Region[]>("regions.json");
}

export function getRegionById(id: string): Region | undefined {
  return getRegions().find((r) => r.id === id);
}

export function getPorts(): Port[] {
  return readSeedJson<Port[]>("ports.json");
}

export function getPortById(id: string): Port | undefined {
  return getPorts().find((p) => p.id === id);
}

export function getContainerTypes(): ContainerType[] {
  return readSeedJson<ContainerType[]>("container-types.json").sort(
    (a, b) => a.order - b.order,
  );
}

export function getChargeTypes(): ChargeType[] {
  return readSeedJson<ChargeType[]>("charge-types.json").sort(
    (a, b) => a.order - b.order,
  );
}

export function getCompany(): CompanyInfo {
  return readSeedJson<CompanyInfo>("company.json");
}

// ---------- Mutable data (Redis when configured, JSON file otherwise) ----------

// Matches @upstash/redis's own Redis.fromEnv() precedence: UPSTASH_REDIS_REST_*
// first, falling back to KV_REST_API_* (how Vercel's legacy KV integration -
// and some marketplace Redis integrations - name the injected env vars).
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const REDIS_ENABLED = Boolean(REDIS_URL && REDIS_TOKEN);

const redis = REDIS_ENABLED ? new Redis({ url: REDIS_URL!, token: REDIS_TOKEN! }) : null;

// Serverless platforms without Redis configured still can't write to their
// bundled source files at runtime (read-only filesystem outside /tmp) - fall
// back to /tmp so at least a single warm instance behaves sanely instead of
// throwing, matching the file's previous stopgap behaviour.
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const LOCAL_WRITE_DIR = IS_SERVERLESS ? path.join("/tmp", "quot-data") : DATA_DIR;

function redisKey(file: string): string {
  return `quot:v1:${file}`;
}

function ensureLocalSeeded(file: string): string {
  const target = path.join(LOCAL_WRITE_DIR, file);
  if (IS_SERVERLESS && !fs.existsSync(target)) {
    fs.mkdirSync(LOCAL_WRITE_DIR, { recursive: true });
    fs.copyFileSync(path.join(DATA_DIR, file), target);
  }
  return target;
}

async function readMutable<T>(file: string): Promise<T> {
  if (redis) {
    const existing = await redis.get<T>(redisKey(file));
    if (existing != null) return existing;
    const seed = readSeedJson<T>(file);
    await redis.set(redisKey(file), seed);
    return seed;
  }
  const filePath = ensureLocalSeeded(file);
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

async function writeMutable<T>(file: string, data: T): Promise<void> {
  if (redis) {
    await redis.set(redisKey(file), data);
    return;
  }
  const filePath = ensureLocalSeeded(file);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export async function getOceanFreightRates(): Promise<OceanFreightRate[]> {
  return readMutable<OceanFreightRate[]>("ocean-freight-rates.json");
}

export async function getChargeRates(): Promise<ChargeRate[]> {
  return readMutable<ChargeRate[]>("charge-rates.json");
}

export async function getExchangeRates(): Promise<ExchangeRate[]> {
  return readMutable<ExchangeRate[]>("exchange-rates.json");
}

export async function getCurrentExchangeRate(currency: string): Promise<ExchangeRate | undefined> {
  const rates = await getExchangeRates();
  return rates.find((e) => e.currency === currency);
}

export async function getCustomers(): Promise<Customer[]> {
  return readMutable<Customer[]>("customers.json");
}

export async function getQuotes(): Promise<Quote[]> {
  return readMutable<Quote[]>("quotes.json");
}

export async function getQuoteById(id: string): Promise<Quote | undefined> {
  const quotes = await getQuotes();
  return quotes.find((q) => q.id === id);
}

// ---------- Writes (admin rate management + quote persistence) ----------

export async function upsertOceanFreightRate(rate: OceanFreightRate): Promise<void> {
  const rates = await getOceanFreightRates();
  const idx = rates.findIndex((r) => r.id === rate.id);
  if (idx >= 0) rates[idx] = rate;
  else rates.push(rate);
  await writeMutable("ocean-freight-rates.json", rates);
}

export async function upsertChargeRate(rate: ChargeRate): Promise<void> {
  const rates = await getChargeRates();
  const idx = rates.findIndex((r) => r.id === rate.id);
  if (idx >= 0) rates[idx] = rate;
  else rates.push(rate);
  await writeMutable("charge-rates.json", rates);
}

export async function upsertExchangeRate(rate: ExchangeRate): Promise<void> {
  const rates = await getExchangeRates();
  const idx = rates.findIndex((r) => r.currency === rate.currency);
  if (idx >= 0) rates[idx] = rate;
  else rates.push(rate);
  await writeMutable("exchange-rates.json", rates);
}

export async function addCustomer(customer: Customer): Promise<void> {
  const customers = await getCustomers();
  customers.push(customer);
  await writeMutable("customers.json", customers);
}

export async function addQuote(quote: Quote): Promise<void> {
  const quotes = await getQuotes();
  quotes.unshift(quote);
  await writeMutable("quotes.json", quotes);
}

export async function deleteQuote(id: string): Promise<void> {
  const quotes = (await getQuotes()).filter((q) => q.id !== id);
  await writeMutable("quotes.json", quotes);
}
