import { headers } from "next/headers";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function clientKeyFromHeaders(headerStore: Headers) {
  const forwarded = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerStore.get("x-real-ip")?.trim();
  return forwarded || realIp || "unknown";
}

export async function checkRateLimit(params: { scope: string; limit: number; windowMs: number }) {
  const headerStore = await headers();
  const now = Date.now();
  const key = `${params.scope}:${clientKeyFromHeaders(headerStore)}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + params.windowMs });
    return { ok: true, remaining: params.limit - 1, resetAt: now + params.windowMs };
  }

  if (current.count >= params.limit) {
    return { ok: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  buckets.set(key, current);
  return { ok: true, remaining: params.limit - current.count, resetAt: current.resetAt };
}
