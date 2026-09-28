import { Redis } from "@upstash/redis";

/** Login-attempt rate limiting for /api/unlock. Same Redis-or-in-memory
 * pattern as src/lib/data-store.ts's mutable data, with its own key
 * namespace - shared Redis when configured (so the limit actually holds
 * across Vercel's multiple serverless instances), falling back to a
 * module-level Map for local dev / no-Redis deployments (resets on
 * restart, single-instance only - the same tradeoff data-store.ts already
 * accepts for this app's scale). */
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const REDIS_ENABLED = Boolean(REDIS_URL && REDIS_TOKEN);
const redis = REDIS_ENABLED ? new Redis({ url: REDIS_URL!, token: REDIS_TOKEN! }) : null;

// Tier 1: a short lockout for a burst of wrong PINs in a row.
const SHORT_THRESHOLD = 3;
const SHORT_LOCK_SECONDS = 60;
// Tier 2: a longer lockout for sustained abuse across a rolling hour,
// even if each burst individually stayed under the tier-1 threshold.
const LONG_THRESHOLD = 10;
const LONG_LOCK_SECONDS = 30 * 60;
const LONG_WINDOW_SECONDS = 60 * 60;

interface MemoryEntry {
  shortCount: number;
  longCount: number;
  longWindowExpiresAt: number;
  lockedUntil: number | null;
}
const memoryStore = new Map<string, MemoryEntry>();

function now(): number {
  return Date.now();
}

function memoryKey(ip: string) {
  return `login:${ip}`;
}

function readMemory(ip: string): MemoryEntry {
  const key = memoryKey(ip);
  const existing = memoryStore.get(key);
  if (existing && existing.longWindowExpiresAt > now()) return existing;
  const fresh: MemoryEntry = {
    shortCount: 0,
    longCount: 0,
    longWindowExpiresAt: now() + LONG_WINDOW_SECONDS * 1000,
    lockedUntil: null,
  };
  memoryStore.set(key, fresh);
  return fresh;
}

function redisKey(ip: string, part: "short" | "long" | "lock") {
  return `quot:v1:ratelimit:${part}:${ip}`;
}

export interface LoginLimitStatus {
  locked: boolean;
  /** Seconds until the lock clears, only present while locked. */
  retryAfterSec?: number;
}

/** Extracts the caller's IP from standard proxy headers (Vercel sets
 * x-forwarded-for). Falls back to a constant for local dev, where every
 * request looks the same anyway - fine, since local dev is single-user. */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function checkLoginLimit(ip: string): Promise<LoginLimitStatus> {
  if (redis) {
    const lockedUntil = await redis.get<number>(redisKey(ip, "lock"));
    if (lockedUntil && lockedUntil > now()) {
      return { locked: true, retryAfterSec: Math.ceil((lockedUntil - now()) / 1000) };
    }
    return { locked: false };
  }
  const entry = readMemory(ip);
  if (entry.lockedUntil && entry.lockedUntil > now()) {
    return { locked: true, retryAfterSec: Math.ceil((entry.lockedUntil - now()) / 1000) };
  }
  return { locked: false };
}

/** Records a failed PIN attempt and returns the resulting lock status
 * (already-locked callers should check checkLoginLimit first and skip
 * calling this at all, so a locked-out attempt never even touches the
 * password comparison). */
export async function recordLoginFailure(ip: string): Promise<LoginLimitStatus> {
  if (redis) {
    const shortCount = await redis.incr(redisKey(ip, "short"));
    if (shortCount === 1) await redis.expire(redisKey(ip, "short"), SHORT_LOCK_SECONDS);
    const longCount = await redis.incr(redisKey(ip, "long"));
    if (longCount === 1) await redis.expire(redisKey(ip, "long"), LONG_WINDOW_SECONDS);

    let lockSeconds: number | null = null;
    if (longCount >= LONG_THRESHOLD) lockSeconds = LONG_LOCK_SECONDS;
    else if (shortCount >= SHORT_THRESHOLD) lockSeconds = SHORT_LOCK_SECONDS;

    if (lockSeconds) {
      const lockedUntil = now() + lockSeconds * 1000;
      await redis.set(redisKey(ip, "lock"), lockedUntil, { ex: lockSeconds + 5 });
      return { locked: true, retryAfterSec: lockSeconds };
    }
    return { locked: false };
  }

  const entry = readMemory(ip);
  entry.shortCount += 1;
  entry.longCount += 1;
  let lockSeconds: number | null = null;
  if (entry.longCount >= LONG_THRESHOLD) lockSeconds = LONG_LOCK_SECONDS;
  else if (entry.shortCount >= SHORT_THRESHOLD) lockSeconds = SHORT_LOCK_SECONDS;
  if (lockSeconds) {
    entry.lockedUntil = now() + lockSeconds * 1000;
    return { locked: true, retryAfterSec: lockSeconds };
  }
  return { locked: false };
}

export async function recordLoginSuccess(ip: string): Promise<void> {
  if (redis) {
    await Promise.all([
      redis.del(redisKey(ip, "short")),
      redis.del(redisKey(ip, "long")),
      redis.del(redisKey(ip, "lock")),
    ]);
    return;
  }
  memoryStore.delete(memoryKey(ip));
}
