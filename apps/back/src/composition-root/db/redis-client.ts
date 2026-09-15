import { Redis } from "ioredis";

let redisClient: Redis | null = null;

export function getRedisClient(url: string): Redis {
  if (redisClient) {
    return redisClient;
  }

  redisClient = new Redis(url, { lazyConnect: true });
  return redisClient;
}
