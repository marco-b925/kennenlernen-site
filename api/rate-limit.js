// Simple token-bucket rate limiter (in-memory, per-function-instance)
// Vercel warm invocations share state; cold starts reset.

const buckets = new Map();
const RATE_LIMIT = 20;       // max requests
const RATE_WINDOW = 60_000;  // per minute

function isRateLimited(ip) {
  const now = Date.now();
  let bucket = buckets.get(ip);

  if (!bucket || now - bucket.windowStart > RATE_WINDOW) {
    bucket = { count: 0, windowStart: now, blockedUntil: 0 };
    buckets.set(ip, bucket);
  }

  if (bucket.blockedUntil > now) {
    return true;
  }

  bucket.count++;
  if (bucket.count > RATE_LIMIT) {
    bucket.blockedUntil = now + RATE_WINDOW;
    return true;
  }

  return false;
}

// Cleanup old entries every 5min
setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW * 2;
  for (const [ip, bucket] of buckets) {
    if (bucket.windowStart < cutoff) buckets.delete(ip);
  }
}, 300_000).unref();

export { isRateLimited };
