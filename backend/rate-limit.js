/** In-memory rate limit per IP. */

const store = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REPLY = 60;
const MAX_SUGGEST = 20;

function getKey(ip) {
  return ip || "unknown";
}

function cleanup() {
  const now = Date.now();
  for (const [key, data] of store.entries()) {
    if (now - data.ts > WINDOW_MS) store.delete(key);
  }
}

export function rateLimitReply(req, res, next) {
  cleanup();
  const key = getKey(req.ip || req.socket?.remoteAddress);
  let data = store.get(key);
  if (!data) {
    data = { count: 0, ts: Date.now() };
    store.set(key, data);
  }
  if (Date.now() - data.ts > WINDOW_MS) {
    data.count = 0;
    data.ts = Date.now();
  }
  data.count++;
  if (data.count > MAX_REPLY) {
    return res.status(429).json({ error: "Too many requests. Try again in a minute." });
  }
  next();
}

export function rateLimitSuggest(req, res, next) {
  cleanup();
  const key = "suggest:" + getKey(req.ip || req.socket?.remoteAddress);
  let data = store.get(key);
  if (!data) {
    data = { count: 0, ts: Date.now() };
    store.set(key, data);
  }
  if (Date.now() - data.ts > WINDOW_MS) {
    data.count = 0;
    data.ts = Date.now();
  }
  data.count++;
  if (data.count > MAX_SUGGEST) {
    return res.status(429).json({ error: "Too many requests. Try again in a minute." });
  }
  next();
}
