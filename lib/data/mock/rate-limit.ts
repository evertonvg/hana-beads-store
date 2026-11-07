import type { RateLimitPort } from "@/lib/data/ports";

import { getMockStore } from "./store";

/** In-memory fixed-window limiter with the same rule as the `rate_limit_hit` SQL function. */
export function createMockRateLimit(): RateLimitPort {
  return {
    hit(key, max, windowSeconds) {
      if (windowSeconds <= 0) return Promise.reject(new Error("invalid_window"));
      const windowMs = windowSeconds * 1000;
      const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
      const { rateLimits } = getMockStore();
      const current = rateLimits[key];
      const count = current?.windowStart === windowStart ? current.count + 1 : 1;
      rateLimits[key] = { windowStart, count };
      return Promise.resolve(count <= max);
    },
  };
}
