/**
 * Tiny fixed-window in-memory rate limiter, generalized from the chatbot
 * route's throttle. Single-process scope is sufficient for this deployment;
 * a multi-instance deployment would need a shared store (Redis).
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs, max, key, message });
 *   router.post('/route', limiter, handler);
 *
 * Buckets are pruned when the map grows past a threshold so memory stays
 * bounded. The limiter never breaks the route: on internal errors it lets
 * the request through.
 */

const buckets = new Map();

function createRateLimiter({ windowMs, max, key, message, statusCode = 429 }) {
  return function rateLimiter(req, res, next) {
    try {
      const bucketKey = key(req);
      if (!bucketKey) return next();

      const now = Date.now();
      let bucket = buckets.get(bucketKey);

      if (!bucket || now - bucket.windowStart > windowMs) {
        bucket = { windowStart: now, count: 0 };
        buckets.set(bucketKey, bucket);
      }

      bucket.count += 1;

      // Keep the map bounded: drop expired buckets when it grows large
      if (buckets.size > 2000) {
        for (const [existingKey, existingBucket] of buckets) {
          if (now - existingBucket.windowStart > windowMs) {
            buckets.delete(existingKey);
          }
        }
      }

      if (bucket.count > max) {
        return res.status(statusCode).json({ error: message });
      }

      next();
    } catch (error) {
      next();
    }
  };
}

module.exports = { createRateLimiter };
