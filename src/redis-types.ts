// src/redis-types.ts
import { createClient, RedisClientType, RedisClientOptions as OriginalOptions, RedisFlushModes } from 'redis';

// Define simplified interface for Redis client options
export interface RedisClientOptions extends OriginalOptions {
  url?: string;
  socket?: {
    connectTimeout?: number;
    reconnectStrategy?: (retries: number) => number;
    tls?: boolean;
  };
  username?: string;
  password?: string;
}

// Define custom interfaces for Redis method options
export interface ScanOptions {
  MATCH?: string;
  COUNT?: number;
}

export interface ZRangeOptions {
  WITHSCORES?: boolean;
}

export interface ZRangeByScoreOptions {
  WITHSCORES?: boolean;
}

export interface XReadOptions {
  COUNT?: number;
  BLOCK?: number;
}

export interface XReadStream {
  key: string;
  id: string;
}

// Export other needed types
export { createClient, RedisClientType, RedisFlushModes };