import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Logger } from './Logger.js';

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // time to live in milliseconds
  version: string;
}

export interface CacheOptions {
  ttl?: number; // default TTL in milliseconds
  maxSize?: number; // maximum number of entries
  persistToDisk?: boolean;
  cacheDirectory?: string;
}

export class ResourceCache {
  private cache = new Map<string, CacheEntry>();
  private readonly defaultTTL: number;
  private readonly maxSize: number;
  private readonly persistToDisk: boolean;
  private readonly cacheDirectory: string;
  private readonly logger: Logger;

  constructor(options: CacheOptions = {}, logger?: Logger) {
    this.defaultTTL = options.ttl || 5 * 60 * 1000; // 5 minutes default
    this.maxSize = options.maxSize || 1000;
    this.persistToDisk = options.persistToDisk || true;
    this.cacheDirectory = options.cacheDirectory || path.join(os.homedir(), '.documentation-generator', 'cache');
    this.logger = logger || new Logger('ResourceCache');

    if (this.persistToDisk) {
      this.initializePersistentCache();
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      // Try to load from disk if persistence is enabled
      if (this.persistToDisk) {
        const diskEntry = await this.loadFromDisk<T>(key);
        if (diskEntry && this.isValid(diskEntry)) {
          this.cache.set(key, diskEntry);
          return diskEntry.data;
        }
      }
      return null;
    }

    if (!this.isValid(entry)) {
      this.cache.delete(key);
      if (this.persistToDisk) {
        await this.removeFromDisk(key);
      }
      return null;
    }

    return entry.data;
  }

  async set<T = any>(key: string, data: T, options?: { ttl?: number; version?: string }): Promise<void> {
    const ttl = options?.ttl || this.defaultTTL;
    const version = options?.version || '1.0.0';

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      version,
    };

    // Remove oldest entries if we're at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, entry);

    if (this.persistToDisk) {
      await this.saveToDisk(key, entry);
    }

    this.logger.debug(`Cache set: ${key} (TTL: ${ttl}ms)`);
  }

  async invalidate(key: string): Promise<void> {
    this.cache.delete(key);
    if (this.persistToDisk) {
      await this.removeFromDisk(key);
    }
    this.logger.debug(`Cache invalidated: ${key}`);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    const keysToDelete = Array.from(this.cache.keys()).filter(key => regex.test(key));

    for (const key of keysToDelete) {
      await this.invalidate(key);
    }

    this.logger.debug(`Cache invalidated pattern: ${pattern} (${keysToDelete.length} entries)`);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    if (this.persistToDisk) {
      await this.clearDisk();
    }
    this.logger.debug('Cache cleared');
  }

  async refresh(key: string, dataProvider: () => Promise<any>): Promise<any> {
    try {
      const data = await dataProvider();
      await this.set(key, data);
      return data;
    } catch (error) {
      this.logger.error(`Failed to refresh cache for key ${key}:`, error);
      throw error;
    }
  }

  async getOrFetch<T = any>(
    key: string,
    dataProvider: () => Promise<T>,
    options?: { ttl?: number; version?: string }
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await dataProvider();
    await this.set(key, data, options);
    return data;
  }

  getStats() {
    const validEntries = Array.from(this.cache.values()).filter(entry => this.isValid(entry));
    const expiredEntries = this.cache.size - validEntries.length;

    return {
      totalEntries: this.cache.size,
      validEntries: validEntries.length,
      expiredEntries,
      memoryUsage: this.estimateMemoryUsage(),
      oldestEntry: validEntries.length > 0 ?
        Math.min(...validEntries.map(entry => entry.timestamp)) : null,
      newestEntry: validEntries.length > 0 ?
        Math.max(...validEntries.map(entry => entry.timestamp)) : null,
    };
  }

  async cleanup(): Promise<void> {
    const beforeSize = this.cache.size;
    const expiredKeys = [];

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isValid(entry)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      await this.invalidate(key);
    }

    this.logger.debug(`Cache cleanup: removed ${expiredKeys.length} expired entries (${beforeSize} -> ${this.cache.size})`);
  }

  private isValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  private evictOldest(): void {
    let oldestKey = '';
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.logger.debug(`Evicted oldest cache entry: ${oldestKey}`);
    }
  }

  private async initializePersistentCache(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDirectory, { recursive: true });
    } catch (error) {
      this.logger.warn('Failed to create cache directory:', error);
      this.persistToDisk = false;
    }
  }

  private async loadFromDisk<T = any>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const filePath = path.join(this.cacheDirectory, `${this.sanitizeKey(key)}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const entry = JSON.parse(content) as CacheEntry<T>;
      return entry;
    } catch {
      return null;
    }
  }

  private async saveToDisk<T = any>(key: string, entry: CacheEntry<T>): Promise<void> {
    try {
      const filePath = path.join(this.cacheDirectory, `${this.sanitizeKey(key)}.json`);
      await fs.writeFile(filePath, JSON.stringify(entry), 'utf-8');
    } catch (error) {
      this.logger.warn(`Failed to save cache entry to disk: ${key}`, error);
    }
  }

  private async removeFromDisk(key: string): Promise<void> {
    try {
      const filePath = path.join(this.cacheDirectory, `${this.sanitizeKey(key)}.json`);
      await fs.unlink(filePath);
    } catch {
      // File might not exist, which is fine
    }
  }

  private async clearDisk(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDirectory);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.cacheDirectory, file));
        }
      }
    } catch (error) {
      this.logger.warn('Failed to clear disk cache:', error);
    }
  }

  private sanitizeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private estimateMemoryUsage(): number {
    let size = 0;
    for (const entry of this.cache.values()) {
      size += JSON.stringify(entry).length * 2; // Rough estimation (UTF-16)
    }
    return size;
  }
}

export class CacheManager {
  private caches = new Map<string, ResourceCache>();
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger('CacheManager');
  }

  getCache(name: string, options?: CacheOptions): ResourceCache {
    if (!this.caches.has(name)) {
      const cache = new ResourceCache(options, this.logger);
      this.caches.set(name, cache);
      this.logger.debug(`Created cache: ${name}`);
    }
    return this.caches.get(name)!;
  }

  async clearAll(): Promise<void> {
    for (const [name, cache] of this.caches.entries()) {
      await cache.clear();
      this.logger.debug(`Cleared cache: ${name}`);
    }
  }

  async cleanupAll(): Promise<void> {
    for (const [name, cache] of this.caches.entries()) {
      await cache.cleanup();
    }
    this.logger.debug('Cleaned up all caches');
  }

  getGlobalStats() {
    const stats = {
      totalCaches: this.caches.size,
      totalEntries: 0,
      totalValidEntries: 0,
      totalMemoryUsage: 0,
      cacheStats: {} as Record<string, any>,
    };

    for (const [name, cache] of this.caches.entries()) {
      const cacheStats = cache.getStats();
      stats.totalEntries += cacheStats.totalEntries;
      stats.totalValidEntries += cacheStats.validEntries;
      stats.totalMemoryUsage += cacheStats.memoryUsage;
      stats.cacheStats[name] = cacheStats;
    }

    return stats;
  }
}