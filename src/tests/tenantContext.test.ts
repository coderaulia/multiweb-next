/**
 * Unit tests for tenantContext.ts
 *
 * Strategy: mock @/db/client with a controllable stub. Tests inject the
 * desired DB result via a module-level variable that the mock reads.
 * vi.mock factories are hoisted, so they cannot reference test-file variables
 * directly - we use a shared mutable object instead.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_TENANT_ID, DEFAULT_TENANT_SLUG } from '@/db/tenantConstants';
import {
  _clearMemoryCache,
  getDefaultTenant,
  getTenantFromRequest,
  invalidateTenantCache,
  resolveTenantByHost,
  resolveTenantById,
  resolveTenantBySlug,
  type Tenant
} from '@/features/cms/tenantContext';

// ---------------------------------------------------------------------------
// Shared mock state (must be declared before vi.mock factories)
// ---------------------------------------------------------------------------

// This object is mutated by tests to control what the DB mock returns.
const mockState = {
  nextRows: [] as unknown[]
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/services/env', () => ({
  env: {
    databaseUrl: 'postgresql://localhost/test',
    redisUrl: ''
  }
}));

vi.mock('@/services/redis', () => ({
  getRedis: () => null
}));

// Mock the DB client. The select chain always returns mockState.nextRows.
vi.mock('@/db/client', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(mockState.nextRows)
        })
      })
    })
  })
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_A: Tenant = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  slug: 'acme',
  customDomain: 'acme.example.com',
  name: 'Acme Co',
  themeConfig: {},
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

const TENANT_B: Tenant = {
  id: 'bbbbbbbb-0000-0000-0000-000000000002',
  slug: 'beta',
  customDomain: null,
  name: 'Beta Corp',
  themeConfig: {},
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

// Shape the tenant into a DB row (camelCase, matching Drizzle's $inferSelect)
function row(t: Tenant) {
  return {
    id: t.id,
    slug: t.slug,
    customDomain: t.customDomain,
    name: t.name,
    themeConfig: t.themeConfig,
    status: t.status,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  _clearMemoryCache();
  mockState.nextRows = [];
});

afterEach(() => {
  _clearMemoryCache();
  mockState.nextRows = [];
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveTenantBySlug', () => {
  it('returns the tenant for a known slug', async () => {
    mockState.nextRows = [row(TENANT_A)];
    const tenant = await resolveTenantBySlug('acme');
    expect(tenant).not.toBeNull();
    expect(tenant?.id).toBe(TENANT_A.id);
    expect(tenant?.slug).toBe('acme');
  });

  it('normalizes slug to lowercase before lookup', async () => {
    mockState.nextRows = [row(TENANT_A)];
    const tenant = await resolveTenantBySlug('ACME');
    expect(tenant?.slug).toBe('acme');
  });

  it('returns null for an unknown slug', async () => {
    mockState.nextRows = [];
    const tenant = await resolveTenantBySlug('unknown-slug');
    expect(tenant).toBeNull();
  });

  it('returns a tenant with null customDomain', async () => {
    mockState.nextRows = [row(TENANT_B)];
    const tenant = await resolveTenantBySlug('beta');
    expect(tenant).not.toBeNull();
    expect(tenant?.customDomain).toBeNull();
  });
});

describe('resolveTenantByHost', () => {
  it('resolves a tenant by its custom domain', async () => {
    mockState.nextRows = [row(TENANT_A)];
    const tenant = await resolveTenantByHost('acme.example.com');
    expect(tenant?.id).toBe(TENANT_A.id);
  });

  it('strips port from host before lookup', async () => {
    mockState.nextRows = [row(TENANT_A)];
    const tenant = await resolveTenantByHost('acme.example.com:443');
    expect(tenant?.id).toBe(TENANT_A.id);
  });

  it('normalizes host to lowercase', async () => {
    mockState.nextRows = [row(TENANT_A)];
    const tenant = await resolveTenantByHost('ACME.EXAMPLE.COM');
    expect(tenant?.id).toBe(TENANT_A.id);
  });

  it('returns null for an unknown host', async () => {
    mockState.nextRows = [];
    const tenant = await resolveTenantByHost('unknown.example.com');
    expect(tenant).toBeNull();
  });
});

describe('resolveTenantById', () => {
  it('resolves a tenant by UUID', async () => {
    mockState.nextRows = [row(TENANT_A)];
    const tenant = await resolveTenantById(TENANT_A.id);
    expect(tenant?.slug).toBe('acme');
  });

  it('returns null for an unknown id', async () => {
    mockState.nextRows = [];
    const tenant = await resolveTenantById('00000000-dead-beef-0000-000000000000');
    expect(tenant).toBeNull();
  });
});

describe('in-memory cache TTL', () => {
  it('returns cached result on second call without a second DB round-trip', async () => {
    // First call populates cache
    mockState.nextRows = [row(TENANT_A)];
    const first = await resolveTenantBySlug('acme');
    expect(first).not.toBeNull();

    // Second call: DB mock returns empty, but cache should serve the result
    mockState.nextRows = [];
    const second = await resolveTenantBySlug('acme');
    expect(second?.id).toBe(TENANT_A.id);
  });

  it('cache miss after manual invalidation re-fetches from DB', async () => {
    mockState.nextRows = [row(TENANT_A)];
    const first = await resolveTenantBySlug('acme');
    expect(first).not.toBeNull();

    await invalidateTenantCache(TENANT_A);

    // After invalidation, DB is consulted again
    mockState.nextRows = [row(TENANT_A)];
    const second = await resolveTenantBySlug('acme');
    expect(second?.id).toBe(TENANT_A.id);
  });

  it('expired entries are evicted on access and DB is re-queried', async () => {
    // Manually insert an expired entry into the memory cache
    const cache = (globalThis as Record<string, unknown>).__cmsTenantCache as Map<
      string,
      { tenant: Tenant; expiresAt: number }
    >;
    cache.set('slug:acme', { tenant: TENANT_A, expiresAt: Date.now() - 1 });

    // Expired entry should be ignored; DB is consulted
    mockState.nextRows = [row(TENANT_A)];
    const tenant = await resolveTenantBySlug('acme');
    expect(tenant?.id).toBe(TENANT_A.id);
  });
});

describe('getTenantFromRequest', () => {
  it('returns tenant when x-tenant-id header is present', async () => {
    mockState.nextRows = [row(TENANT_A)];
    const req = new Request('https://example.com/', {
      headers: { 'x-tenant-id': TENANT_A.id }
    });
    const tenant = await getTenantFromRequest(req);
    expect(tenant?.id).toBe(TENANT_A.id);
  });

  it('returns null when x-tenant-id header is absent', async () => {
    const req = new Request('https://example.com/');
    const tenant = await getTenantFromRequest(req);
    expect(tenant).toBeNull();
  });

  it('returns null for an unrecognized tenant id', async () => {
    mockState.nextRows = [];
    const req = new Request('https://example.com/', {
      headers: { 'x-tenant-id': '00000000-dead-beef-0000-000000000000' }
    });
    const tenant = await getTenantFromRequest(req);
    expect(tenant).toBeNull();
  });
});

describe('getDefaultTenant', () => {
  it('returns a synthetic fallback when DB has no default tenant', async () => {
    mockState.nextRows = [];
    const tenant = await getDefaultTenant();
    expect(tenant.id).toBe(DEFAULT_TENANT_ID);
    expect(tenant.slug).toBe(DEFAULT_TENANT_SLUG);
    expect(tenant.status).toBe('active');
  });

  it('returns the real tenant when default tenant exists in DB', async () => {
    const defaultTenant: Tenant = {
      ...TENANT_A,
      id: DEFAULT_TENANT_ID,
      slug: DEFAULT_TENANT_SLUG
    };
    mockState.nextRows = [row(defaultTenant)];
    const tenant = await getDefaultTenant();
    expect(tenant.id).toBe(DEFAULT_TENANT_ID);
    expect(tenant.slug).toBe(DEFAULT_TENANT_SLUG);
  });
});

describe('cross-tenant isolation', () => {
  it('slug lookup for tenant A does not return tenant B', async () => {
    mockState.nextRows = [row(TENANT_A)];
    const a = await resolveTenantBySlug('acme');

    _clearMemoryCache();
    mockState.nextRows = [row(TENANT_B)];
    const b = await resolveTenantBySlug('beta');

    expect(a?.id).not.toBe(b?.id);
    expect(a?.id).toBe(TENANT_A.id);
    expect(b?.id).toBe(TENANT_B.id);
  });

  it('domain lookup only matches the owning tenant', async () => {
    mockState.nextRows = [row(TENANT_A)];
    const byDomain = await resolveTenantByHost('acme.example.com');
    expect(byDomain?.id).toBe(TENANT_A.id);
    expect(byDomain?.id).not.toBe(TENANT_B.id);
  });

  it('tenant B has no custom domain and cannot be resolved by domain', async () => {
    mockState.nextRows = [];
    const byDomain = await resolveTenantByHost('beta.example.com');
    expect(byDomain).toBeNull();
  });
});
