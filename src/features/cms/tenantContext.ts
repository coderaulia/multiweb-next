import { eq } from 'drizzle-orm';

import { getDb } from '@/db/client';
import { tenantsTable, type TenantStatus } from '@/db/schema';
import { DEFAULT_TENANT_ID, DEFAULT_TENANT_SLUG } from '@/db/tenantConstants';
import { env } from '@/services/env';
import { getRedis } from '@/services/redis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Tenant = {
  id: string;
  slug: string;
  customDomain: string | null;
  name: string;
  themeConfig: Record<string, unknown>;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
};

type CacheEntry = {
  tenant: Tenant;
  expiresAt: number;
};

// ---------------------------------------------------------------------------
// In-memory cache (fallback when Redis is unavailable)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 60_000; // 60 seconds
const REDIS_TTL_SEC = 60;
const REDIS_KEY_PREFIX = 'tenant:';

declare global {
  var __cmsTenantCache: Map<string, CacheEntry> | undefined;
}

function getMemoryCache(): Map<string, CacheEntry> {
  if (!globalThis.__cmsTenantCache) {
    globalThis.__cmsTenantCache = new Map();
  }
  return globalThis.__cmsTenantCache;
}

function memoryGet(key: string): Tenant | null {
  const entry = getMemoryCache().get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    getMemoryCache().delete(key);
    return null;
  }
  return entry.tenant;
}

function memorySet(key: string, tenant: Tenant): void {
  getMemoryCache().set(key, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
}

function memoryDelete(key: string): void {
  getMemoryCache().delete(key);
}

// ---------------------------------------------------------------------------
// Redis cache helpers
// ---------------------------------------------------------------------------

async function redisGet(key: string): Promise<Tenant | null> {
  const redis = getRedis();
  if (!redis || redis.status !== 'ready') return null;
  try {
    const raw = await redis.get(`${REDIS_KEY_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as Tenant;
  } catch {
    return null;
  }
}

async function redisSet(key: string, tenant: Tenant): Promise<void> {
  const redis = getRedis();
  if (!redis || redis.status !== 'ready') return;
  try {
    await redis.set(`${REDIS_KEY_PREFIX}${key}`, JSON.stringify(tenant), 'EX', REDIS_TTL_SEC);
  } catch {
    // ignore Redis write failures
  }
}

async function redisDelete(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis || redis.status !== 'ready') return;
  try {
    await redis.del(`${REDIS_KEY_PREFIX}${key}`);
  } catch {
    // ignore Redis delete failures
  }
}

// ---------------------------------------------------------------------------
// Cache read/write (Redis first, memory fallback)
// ---------------------------------------------------------------------------

async function cacheGet(key: string): Promise<Tenant | null> {
  const fromRedis = await redisGet(key);
  if (fromRedis) return fromRedis;
  return memoryGet(key);
}

async function cacheSet(key: string, tenant: Tenant): Promise<void> {
  memorySet(key, tenant);
  await redisSet(key, tenant);
}

async function cacheDelete(key: string): Promise<void> {
  memoryDelete(key);
  await redisDelete(key);
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function mapRow(row: typeof tenantsTable.$inferSelect): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    customDomain: row.customDomain ?? null,
    name: row.name,
    themeConfig: (row.themeConfig as Record<string, unknown>) ?? {},
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

async function fetchBySlug(slug: string): Promise<Tenant | null> {
  if (!env.databaseUrl) return null;
  try {
    const rows = await getDb()
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, slug.toLowerCase()))
      .limit(1);
    return rows[0] ? mapRow(rows[0]) : null;
  } catch {
    return null;
  }
}

async function fetchByCustomDomain(domain: string): Promise<Tenant | null> {
  if (!env.databaseUrl) return null;
  try {
    const rows = await getDb()
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.customDomain, domain.toLowerCase()))
      .limit(1);
    return rows[0] ? mapRow(rows[0]) : null;
  } catch {
    return null;
  }
}

async function fetchById(id: string): Promise<Tenant | null> {
  if (!env.databaseUrl) return null;
  try {
    const rows = await getDb()
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, id))
      .limit(1);
    return rows[0] ? mapRow(rows[0]) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a tenant by its slug.
 * Results are cached for 60 seconds.
 */
export async function resolveTenantBySlug(slug: string): Promise<Tenant | null> {
  const normalized = slug.toLowerCase();
  const cacheKey = `slug:${normalized}`;

  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const tenant = await fetchBySlug(normalized);
  if (tenant) {
    await cacheSet(cacheKey, tenant);
    // Also cache by id and domain for cross-lookup hits
    await cacheSet(`id:${tenant.id}`, tenant);
    if (tenant.customDomain) {
      await cacheSet(`domain:${tenant.customDomain}`, tenant);
    }
  }
  return tenant;
}

/**
 * Resolve a tenant by its custom domain.
 * Checks custom_domain first. Falls back to null if not found.
 * Results are cached for 60 seconds.
 */
export async function resolveTenantByHost(host: string): Promise<Tenant | null> {
  const normalized = host.toLowerCase().split(':')[0]; // strip port
  const cacheKey = `domain:${normalized}`;

  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const tenant = await fetchByCustomDomain(normalized);
  if (tenant) {
    await cacheSet(cacheKey, tenant);
    await cacheSet(`slug:${tenant.slug}`, tenant);
    await cacheSet(`id:${tenant.id}`, tenant);
  }
  return tenant;
}

/**
 * Resolve a tenant by its UUID.
 * Results are cached for 60 seconds.
 */
export async function resolveTenantById(id: string): Promise<Tenant | null> {
  const cacheKey = `id:${id}`;

  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const tenant = await fetchById(id);
  if (tenant) {
    await cacheSet(cacheKey, tenant);
    await cacheSet(`slug:${tenant.slug}`, tenant);
    if (tenant.customDomain) {
      await cacheSet(`domain:${tenant.customDomain}`, tenant);
    }
  }
  return tenant;
}

/**
 * Read the tenant ID from the x-tenant-id header set by middleware.
 * Returns null if the header is absent or the tenant cannot be resolved.
 */
export async function getTenantFromRequest(req: Request): Promise<Tenant | null> {
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) return null;
  return resolveTenantById(tenantId);
}

/**
 * Invalidate all cache entries for a tenant (by id, slug, and domain).
 * Call this after updating a tenant row.
 */
export async function invalidateTenantCache(tenant: Tenant): Promise<void> {
  await Promise.all([
    cacheDelete(`id:${tenant.id}`),
    cacheDelete(`slug:${tenant.slug}`),
    tenant.customDomain ? cacheDelete(`domain:${tenant.customDomain}`) : Promise.resolve()
  ]);
}

/**
 * Return the default tenant (slug: 'default') used during the migration period.
 * Falls back to a synthetic tenant object when the DB is unavailable.
 */
export async function getDefaultTenant(): Promise<Tenant> {
  const tenant = await resolveTenantBySlug(DEFAULT_TENANT_SLUG);
  if (tenant) return tenant;

  // Synthetic fallback for environments where the DB is not yet migrated
  return {
    id: DEFAULT_TENANT_ID,
    slug: DEFAULT_TENANT_SLUG,
    customDomain: null,
    name: 'Default',
    themeConfig: {},
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// ---------------------------------------------------------------------------
// Test helpers (exported only for unit tests)
// ---------------------------------------------------------------------------

/** Clear the in-memory cache. Used in tests to reset state between cases. */
export function _clearMemoryCache(): void {
  getMemoryCache().clear();
}
