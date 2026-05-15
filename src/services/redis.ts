import Redis from 'ioredis';

import { env } from '@/services/env';

let redisClient: Redis | null = null;
let connectionFailed = false;

/**
 * Get a shared Redis client instance. Returns null if REDIS_URL is not configured
 * or if the connection previously failed (avoids repeated connection attempts).
 */
export function getRedis(): Redis | null {
  if (!env.redisUrl) return null;
  if (connectionFailed) return null;

  if (!redisClient) {
    redisClient = new Redis(env.redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 3) {
          connectionFailed = true;
          return null; // stop retrying
        }
        return Math.min(times * 200, 1000);
      },
      lazyConnect: true
    });

    redisClient.on('error', () => {
      // Suppress unhandled error events; connection failures are handled via retryStrategy
    });
  }

  return redisClient;
}

/**
 * Attempt to connect to Redis. Returns true if successful, false otherwise.
 * Safe to call multiple times.
 */
export async function connectRedis(): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;

  try {
    if (client.status === 'ready') return true;
    if (client.status === 'connecting') {
      await new Promise<void>((resolve) => {
        client.once('ready', resolve);
        client.once('error', () => resolve());
      });
      return (client.status as string) === 'ready';
    }
    await client.connect();
    return true;
  } catch {
    connectionFailed = true;
    return false;
  }
}

/**
 * Disconnect Redis client gracefully. Used during shutdown.
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    }
    redisClient = null;
    connectionFailed = false;
  }
}
