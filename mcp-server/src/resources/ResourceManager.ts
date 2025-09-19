import { Resource } from '@modelcontextprotocol/sdk/types.js';
import { Logger } from '../utils/Logger.js';
import { CacheManager, ResourceCache } from '../utils/ResourceCache.js';

export interface ResourceProvider {
  name: string;
  getResources(): Promise<Resource[]>;
  readResource(uri: string): Promise<string>;
}

export interface CacheableResourceProvider extends ResourceProvider {
  getCacheKey?(uri: string): string;
  getCacheTTL?(uri: string): number;
  shouldCache?(uri: string): boolean;
}

export class ResourceManager {
  private providers = new Map<string, ResourceProvider>();
  private cacheManager: CacheManager;
  private resourceCache: ResourceCache;
  private listCache: ResourceCache;

  constructor(private logger: Logger) {
    this.cacheManager = new CacheManager(logger);
    this.resourceCache = this.cacheManager.getCache('resources', {
      ttl: 5 * 60 * 1000, // 5 minutes
      maxSize: 1000,
      persistToDisk: true,
    });
    this.listCache = this.cacheManager.getCache('resource-lists', {
      ttl: 2 * 60 * 1000, // 2 minutes
      maxSize: 100,
      persistToDisk: false,
    });
  }

  registerProvider(name: string, provider: ResourceProvider): void {
    this.providers.set(name, provider);
    this.logger.info(`Registered resource provider: ${name}`);
  }

  unregisterProvider(name: string): void {
    this.providers.delete(name);
    this.logger.info(`Unregistered resource provider: ${name}`);
  }

  getProvider(name: string): ResourceProvider | undefined {
    return this.providers.get(name);
  }

  async listResources(): Promise<Resource[]> {
    const cacheKey = 'all-resources';

    return await this.listCache.getOrFetch(cacheKey, async () => {
      const allResources: Resource[] = [];

      for (const [name, provider] of this.providers.entries()) {
        try {
          const resources = await provider.getResources();
          allResources.push(...resources);
          this.logger.debug(`Got ${resources.length} resources from provider: ${name}`);
        } catch (error) {
          this.logger.error(`Failed to get resources from provider ${name}:`, error);
        }
      }

      return allResources;
    });
  }

  async readResource(uri: string): Promise<string> {
    const cacheKey = `resource:${uri}`;

    // Check if any provider supports caching for this URI
    const cacheableProvider = Array.from(this.providers.values())
      .find(provider => this.shouldCacheResource(provider, uri)) as CacheableResourceProvider;

    if (cacheableProvider) {
      const customCacheKey = cacheableProvider.getCacheKey?.(uri) || cacheKey;
      const customTTL = cacheableProvider.getCacheTTL?.(uri);

      return await this.resourceCache.getOrFetch(
        customCacheKey,
        () => this.readResourceUncached(uri),
        { ttl: customTTL }
      );
    }

    return await this.readResourceUncached(uri);
  }

  private async readResourceUncached(uri: string): Promise<string> {
    for (const [name, provider] of this.providers.entries()) {
      try {
        const content = await provider.readResource(uri);
        this.logger.debug(`Successfully read resource ${uri} from provider: ${name}`);
        return content;
      } catch (error) {
        // Try next provider
        this.logger.debug(`Provider ${name} could not read resource ${uri}:`, error);
        continue;
      }
    }

    throw new Error(`No provider found for resource URI: ${uri}`);
  }

  private shouldCacheResource(provider: ResourceProvider, uri: string): boolean {
    const cacheableProvider = provider as CacheableResourceProvider;
    return cacheableProvider.shouldCache?.(uri) ?? true; // Cache by default
  }

  // Cache management methods
  async invalidateCache(uri?: string): Promise<void> {
    if (uri) {
      await this.resourceCache.invalidate(`resource:${uri}`);
      this.logger.debug(`Invalidated cache for resource: ${uri}`);
    } else {
      await this.resourceCache.clear();
      await this.listCache.clear();
      this.logger.debug('Cleared all resource caches');
    }
  }

  async invalidateCachePattern(pattern: string): Promise<void> {
    await this.resourceCache.invalidatePattern(pattern);
    this.logger.debug(`Invalidated cache pattern: ${pattern}`);
  }

  async refreshResource(uri: string): Promise<string> {
    await this.invalidateCache(uri);
    return await this.readResource(uri);
  }

  async refreshAllResources(): Promise<Resource[]> {
    await this.listCache.clear();
    return await this.listResources();
  }

  getCacheStats() {
    return this.cacheManager.getGlobalStats();
  }

  async cleanupCache(): Promise<void> {
    await this.cacheManager.cleanupAll();
  }

  // Real-time update methods
  async notifyResourceChange(providerName: string, uri?: string): Promise<void> {
    if (uri) {
      await this.invalidateCache(uri);
    } else {
      // Invalidate all resources from this provider
      await this.invalidateCachePattern(`.*${providerName}.*`);
    }

    // Always invalidate resource lists when any resource changes
    await this.listCache.clear();

    this.logger.debug(`Notified resource change: ${providerName}${uri ? ` (${uri})` : ''}`);
  }
}