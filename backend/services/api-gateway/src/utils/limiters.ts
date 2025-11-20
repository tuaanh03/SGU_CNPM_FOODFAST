import rateLimit from "express-rate-limit";
import { rateLimitHitsCounter } from "../metrics";

// Auth limiter: 50 requests per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100000,
  message: { error: "Too many requests to /auth, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    // Track rate limit blocked
    rateLimitHitsCounter.inc({ endpoint: '/api/auth', action: 'blocked' });
    res.status(429).json({ error: "Too many requests to /auth, please try again later." });
  },
  skip: (req) => {
    // Track rate limit allowed
    rateLimitHitsCounter.inc({ endpoint: '/api/auth', action: 'allowed' });
    return false;
  }
});

// Order limiter: 10 requests per minute
export const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100000,
  message: { error: "Too many requests to /order, please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    // Track rate limit blocked
    rateLimitHitsCounter.inc({ endpoint: '/api/order', action: 'blocked' });
    res.status(429).json({ error: "Too many requests to /order, please slow down." });
  },
  skip: (req) => {
    // Track rate limit allowed
    rateLimitHitsCounter.inc({ endpoint: '/api/order', action: 'allowed' });
    return false;
  }
});
