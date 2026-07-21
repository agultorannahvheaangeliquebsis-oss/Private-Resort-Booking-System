import "server-only";
import { headers } from "next/headers";

/** Best-effort caller IP from proxy headers. Buckets together if absent. */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

type Bucket = { count: number; resetAt: number };

// In-memory fixed-window limiter. This app is self-hosted as a single Node
// process (see auth.config.ts), not deployed across multiple serverless
// instances, so a process-local Map is sufficient — no shared store needed.
const buckets = new Map<string, Bucket>();

const PURGE_INTERVAL_MS = 10 * 60 * 1000;
let lastPurge = Date.now();

/** Drop expired buckets periodically so the map doesn't grow unbounded. */
function purgeExpired(now: number) {
  if (now - lastPurge < PURGE_INTERVAL_MS) return;
  lastPurge = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Fixed-window rate limit. `key` should already include the action name
 * (e.g. "login:1.2.3.4") so different actions don't share a budget.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now();
  purgeExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { ok: true };
}
