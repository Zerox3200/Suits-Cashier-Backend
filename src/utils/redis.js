import redis from "redis";
import { logger } from "./logger.js";

let client = null;
let isConnected = false;
let connectionAttempted = false;
let errorLogged = false;

export const isRedisReady = () => Boolean(client && isConnected);

export const getRedisClient = () => (isRedisReady() ? client : null);

const initRedis = async () => {
  if (connectionAttempted) return;

  connectionAttempted = true;

  try {
    client = redis.createClient({
      url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.warn("Redis max reconnection attempts reached");
            return false;
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    client.on("error", (err) => {
      isConnected = false;
      if (!errorLogged && err.code === "ECONNREFUSED") {
        errorLogged = true;
        logger.warn("Redis unavailable — caching and queues disabled");
      }
    });

    client.on("connect", () => {
      isConnected = true;
    });

    client.on("ready", () => {
      isConnected = true;
      logger.info("Redis connected");
    });

    client.on("end", () => {
      isConnected = false;
    });

    await client.connect();
    isConnected = true;
  } catch {
    isConnected = false;
    if (!errorLogged) {
      errorLogged = true;
      logger.warn("Redis unavailable — caching and queues disabled");
    }
  }
};

initRedis();

/** Wait until Redis is ready (deploy scripts / startup). */
export const waitForRedisReady = async (timeoutMs = 10_000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (isRedisReady()) return true;
    if (!connectionAttempted) {
      await initRedis();
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return isRedisReady();
};

export const getDefaultCacheTtl = () => {
  const parsed = Number(process.env.CACHE_TTL_SECONDS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
};

const setCache = async (key, value, expiryInSeconds = getDefaultCacheTtl()) => {
  if (!isRedisReady()) return null;

  try {
    return await client.setEx(key, expiryInSeconds, JSON.stringify(value));
  } catch (err) {
    logger.debug({ key, err: err.message }, "redis setCache failed");
    return null;
  }
};

const getCache = async (key) => {
  if (!isRedisReady()) return null;

  try {
    const reply = await client.get(key);
    if (!reply) return null;
    return JSON.parse(reply);
  } catch (err) {
    logger.debug({ key, err: err.message }, "redis getCache failed");
    return null;
  }
};

const getRedisValue = async (key) => {
  if (!isRedisReady()) return null;

  try {
    return await client.get(key);
  } catch (err) {
    logger.debug({ key, err: err.message }, "redis get failed");
    return null;
  }
};

const incrRedisValue = async (key) => {
  if (!isRedisReady()) return 0;

  try {
    return await client.incr(key);
  } catch (err) {
    logger.debug({ key, err: err.message }, "redis incr failed");
    return 0;
  }
};

const deleteCache = async (key) => {
  if (!isRedisReady()) return null;

  try {
    return await client.del(key);
  } catch (err) {
    logger.debug({ key, err: err.message }, "redis deleteCache failed");
    return null;
  }
};

const normalizeScanKeys = (chunk) => {
  const items = Array.isArray(chunk) ? chunk : [chunk];
  return items
    .map((key) => {
      if (typeof key === "string") return key;
      if (key == null) return "";
      if (Buffer.isBuffer(key)) return key.toString("utf8");
      return String(key);
    })
    .filter(Boolean);
};

const deleteCacheByPattern = async (pattern) => {
  if (!isRedisReady()) {
    logger.warn({ pattern }, "redis pattern delete skipped — not connected");
    return 0;
  }

  try {
    let totalDeleted = 0;

    for await (const chunk of client.scanIterator({
      MATCH: pattern,
      COUNT: 200,
    })) {
      const keys = normalizeScanKeys(chunk);
      if (!keys.length) continue;

      const deleted = await client.del(keys);
      totalDeleted += Number(deleted) || 0;
    }

    if (totalDeleted > 0) {
      logger.info({ pattern, totalDeleted }, "redis pattern delete");
    }

    return totalDeleted;
  } catch (err) {
    logger.warn({ pattern, err: err.message }, "redis deleteCacheByPattern failed");
    return 0;
  }
};

export {
  setCache,
  getCache,
  getRedisValue,
  incrRedisValue,
  deleteCache,
  deleteCacheByPattern,
};
