# Implementation Plan

Last updated: 2026-05-15

---

## Infrastructure Stack

- **Runtime:** Next.js App Router (self-hosted, standalone output)
- **Database:** PostgreSQL 16 (local for dev, Docker or bare on VPS for prod)
- **ORM:** Drizzle ORM (already integrated)
- **Object Storage:** MinIO (self-hosted, S3-compatible) or Cloudflare R2
- **Reverse Proxy:** Caddy (on-demand TLS for custom domains)
- **Cache / Rate Limiting:** Redis (sessions, rate limits, tenant resolution cache)
- **Background Jobs:** BullMQ (Redis-backed, for scheduled publish, DNS polling, media processing)
- **Auth:** Custom (scrypt + pepper, cookie sessions in Postgres, Redis fallback)

---

## Part A: Security Hardening

Audit date: 2026-05-13
Scope: All API routes, forms, auth, file upload, headers

### Severity Legend

- **Critical** - Exploitable now, fix before next deploy
- **High** - Significant abuse vector, fix this sprint
- **Medium** - Best-practice gap, fix next sprint
- **Low** - Hardening / hygiene, backlog

---

### C-1 - Analytics endpoints unprotected [DONE]

**Files:** `src/app/api/analytics/page-view/route.ts`, `src/app/api/analytics/event/route.ts`

**Issue:** Both POST endpoints had zero rate limiting and no input length caps.

**Completed:**
- [x] Rate limiting added (60 req/min per IP)
- [x] Max-length validation on all string fields (visitorId, sessionId, referrer, utm*)
- [ ] Consider moving `/api/analytics/event` behind admin auth if only admin dashboards call it

---

### C-2 - X-Forwarded-For spoofing [DONE]

**File:** `src/services/requestSecurity.ts`

**Issue:** `getClientIdentifier()` blindly trusted X-Forwarded-For, allowing IP spoofing to bypass all rate limits.

**Completed:**
- [x] `TRUSTED_PROXY_COUNT` env var added
- [x] `getClientIdentifier()` rewritten with trusted-proxy-aware extraction
- [x] Login lockout uses same function
- [ ] Manual test with `TRUSTED_PROXY_COUNT=0` and `=1`

---

### H-1 - File upload magic bytes validation [DONE]

**File:** `src/services/mediaStorage.ts`

**Issue:** Only checked client-supplied MIME type. SVG allowed (stored XSS risk).

**Completed:**
- [x] `validateMagicBytes()` implemented
- [x] SVG uploads blocked entirely
- [x] Max file size enforced server-side (10 MB)
- [x] File extension allowlist as secondary guard

---

### H-2 - Analytics input length caps [DONE]

Covered by C-1 fix. All string fields capped before DB insert.

---

### M-1 - Granular permission checks [DONE]

**Files:** `src/app/api/admin/contact-submissions/route.ts`, `[id]/route.ts`

**Completed:**
- [x] Audited all admin API routes
- [x] Contact submissions routes now use `assertAdminPermission(request, 'content:edit')`

---

### M-2 - Password pepper [DONE]

**File:** `src/features/cms/adminAuth.ts`

**Completed:**
- [x] `PASSWORD_PEPPER` env var (hex-encoded, 32+ bytes)
- [x] New peppered format: `p1:salt:hash`
- [x] Legacy hashes verified normally, transparently re-hashed on next login
- [x] Documented in `.env.example`

---

### M-3 - Fallback session safeguards [DONE]

**File:** `src/features/cms/adminAuth.ts`

**Completed:**
- [x] Warning log when fallback activates
- [x] Capped at 500 entries with oldest-eviction
- [ ] Add note to ops runbook

---

### M-4 - Multi-device logout [DONE]

**File:** `src/features/cms/adminAuth.ts`, `src/app/api/admin/auth/logout-all/route.ts`

**Completed:**
- [x] `logoutAllSessions(userId)` function
- [x] `POST /api/admin/auth/logout-all` route
- [ ] "Sign out all devices" button in admin profile UI

---

### L-1 - CSRF origin-check comment [DONE]

- [x] Comment explaining the OR logic intent added to `requestSecurity.ts`

---

### L-2 - X-XSS-Protection header [DONE]

- [x] `X-XSS-Protection: 1; mode=block` added to `middleware.ts`

---

### L-3 - Webhook token scrubbing [DONE]

- [x] Catch block in `contactNotifications.ts` logs only error message, never headers

---

### Remaining security tasks

- [ ] Manual test: TRUSTED_PROXY_COUNT with 0 and 1
- [ ] Consider analytics/event behind admin auth
- [ ] "Sign out all devices" button in admin profile UI
- [ ] Ops runbook note about fallback sessions

---

## Part B: Backend Rework (Remove Supabase)

### Goal

Remove `@supabase/supabase-js` dependency entirely. Replace with:
- Direct Postgres connection (already using Drizzle)
- MinIO or R2 for object storage (S3 API, already have R2 client code)
- Redis for rate limiting, sessions, and cache

### Phase B-1 - Remove Supabase storage client

**Files to modify:**
- `src/services/mediaStorage.ts` - remove Supabase storage path, keep R2 + local
- `src/services/env.ts` - remove `supabaseUrl`, `supabaseServiceRoleKey`, `supabaseStorageBucket`
- `.env.example` - remove Supabase vars, add MinIO vars
- `package.json` - remove `@supabase/supabase-js`
- `scripts/migrate-media-to-supabase.ts` - delete or rename to `migrate-media-to-s3.ts`
- `scripts/purge-supabase.ts` - delete
- `scripts/reset-supabase.ts` - delete

**New env vars:**
```
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=cms-media
S3_PUBLIC_URL=http://localhost:9000/cms-media
S3_REGION=us-east-1
```

**Tasks:**
- [ ] Replace Supabase upload/delete with S3 client (already have `@aws-sdk/client-s3`)
- [ ] Unify R2 and MinIO paths (both are S3-compatible, single code path)
- [ ] Remove `@supabase/supabase-js` from package.json
- [ ] Delete Supabase-specific scripts
- [ ] Update `.env.example` and `.env.local`
- [ ] Verify media upload/delete still works with MinIO locally
- [ ] `npm run check` must pass

---

### Phase B-2 - Add Redis for rate limiting

**New dependency:** `ioredis`

**Files to modify:**
- `src/services/redis.ts` (new) - Redis client singleton
- `src/services/requestSecurity.ts` - replace DB-backed rate limiting with Redis
- `src/services/env.ts` - add `REDIS_URL`
- `.env.example` - add `REDIS_URL`

**New env vars:**
```
REDIS_URL=redis://localhost:6379
```

**Tasks:**
- [ ] Create `src/services/redis.ts` with lazy connection
- [ ] Rewrite `assertRateLimit` to use Redis INCR + EXPIRE (atomic, no table needed)
- [ ] Keep in-memory fallback if Redis is unavailable
- [ ] Remove `request_rate_limits` table from schema (or keep as dead code for now)
- [ ] `npm run check` must pass

---

### Phase B-3 - Redis session fallback

**Files to modify:**
- `src/features/cms/adminAuth.ts` - replace in-memory fallback with Redis
- `src/services/redis.ts` - add session helpers

**Tasks:**
- [ ] When DB is unavailable, store sessions in Redis instead of in-memory Map
- [ ] Sessions in Redis get TTL matching SESSION_TTL_MS
- [ ] Remove `global.__cmsAdminFallbackSessions` hack
- [ ] `npm run check` must pass

---

### Phase B-4 - Clean up database connection

**Files to modify:**
- `src/db/client.ts` - simplify, remove Supabase connection string handling if any
- `drizzle.config.ts` - verify works with plain Postgres URL

**Tasks:**
- [ ] Verify connection pooling works with `postgres://` URL directly
- [ ] Document Docker Compose setup for local Postgres + Redis + MinIO
- [ ] `npm run check` must pass

---

## Part C: Multi-Tenant Conversion

### Overview

Convert single-tenant CMS to multi-tenant on a single deployment:
- `domain.com/client-slug` (path-based)
- `clientdomain.com` (custom domain) - both serve the same tenant

Big clients continue using the `bootstrap:client` fork workflow (not removed).

### Constraints

- Postgres mode only for multi-tenant
- Type-system must make it impossible to forget tenant scoping on queries
- Zero data loss for existing single tenant during migration
- Reserved slugs: `admin`, `api`, `_next`, `static`, `login`, `signup`, `dashboard`, `app`, `www`, `mail`, `assets`, `media`, `cdn`, `docs`
- Self-hosted with Caddy reverse proxy for on-demand TLS

---

### Phase C-1 - Schema + Migration

- Add `tenants` table:
  - `id` (uuid pk)
  - `slug` (unique, lowercase kebab)
  - `custom_domain` (unique nullable)
  - `name` (text, not null)
  - `theme_config` (jsonb, default `{}`)
  - `status` (`active` | `suspended`, default `active`)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
- Add nullable `tenant_id` FK to: `pages`, `blog_posts`, `portfolio_projects`, `media_assets`, `contact_submissions`, `admin_audit_logs`, `admin_users`, `admin_sessions`, `site_settings`, `categories`, `portfolio_tags`, `comments`, `cms_content_revisions`, `analytics_events`, `notifications`, `redirects`, `page_404_log`, `user_dashboard_preferences`
- Backfill all existing rows with a single `default` tenant (slug: `default`)
- Alter `tenant_id` columns to NOT NULL
- Drop existing unique constraints on `slug` columns, add composite unique `(tenant_id, slug)`
- Add index on `tenants.custom_domain`
- Generate migration with `npm run db:generate`, verify SQL before applying

**Unscoped tables (no tenant_id):**
- `request_rate_limits` - infrastructure, cross-tenant (moving to Redis anyway)
- `admin_login_lockouts` - keyed by IP/identifier, cross-tenant
- `post_categories` - join table, parent rows are already scoped
- `portfolio_project_tags` - join table, parent rows are already scoped

---

### Phase C-2a - Tenant Context Helper

Create `src/features/cms/tenantContext.ts`:
- `resolveTenantByHost(host: string)` - check `custom_domain` first, fall back to root
- `resolveTenantBySlug(slug: string)`
- Redis cache with 60s TTL (fall back to in-memory Map if Redis unavailable)
- `getTenantFromRequest(req)` - reads `x-tenant-id` header (set by middleware)
- Unit tests for cache TTL and lookup paths

---

### Phase C-2b - Middleware + `[tenant]` Segment

- Update `middleware.ts`:
  - Skip `/admin`, `/api`, `/_next`, static
  - Match host against custom domains. If hit, rewrite path to `/{tenant.slug}/...` and set `x-tenant-id` header
  - If host is root domain, parse first path segment as slug, validate against reserved list
  - 404 if no tenant resolved
- Move public routes under `app/(public)/[tenant]/`
- Keep `app/admin/` and `app/api/` at top level
- Verify path-based and custom-domain routing both serve same tenant content

---

### Phase C-3 - Store Refactor (Factory Pattern)

Highest-risk phase.

- Refactor `contentStore.ts`, `publicApi.ts`, `dbStore.ts` with tenant-scoped factory:

```ts
export function getStore(tenantId: string) {
  return {
    getPublishedPage: (slug) => /* scoped query */,
    listBlogPosts: () => /* scoped */,
    // ...
  };
}
```

- Every Drizzle query must include `.where(eq(table.tenantId, tenantId))`
- Update all callers (admin API routes, public pages)
- Keep file store functional for forked single-tenant path (gate on `DATABASE_URL`)
- Update existing tests, add cross-tenant isolation tests
- `npm run check` must pass

---

### Phase C-4 - Admin Scoping

- Add `tenant_id` to session cookie payload
- New role `super_admin` (platform owner) - can list and switch tenants
- Tenant admins only see their own data
- `assertAdminPermission` verifies `session.tenantId === resource.tenantId` (except super_admin)
- Tenant switcher in admin UI (super_admin only)
- First-run bootstrap: create `default` tenant + super_admin from env vars

---

### Phase C-5 - Cache Scoping

- Tags become tenant-scoped: `tenant:{id}:pages`, `tenant:{id}:blog`, etc.
- `revalidatePublicCmsCache(tenantId, type)` - no more global busts
- Use Redis pub/sub for cache invalidation across instances (future-proof)

---

### Phase C-6 - Per-Tenant Theming

- Move brand/nav/SEO defaults from `site-profile.ts` into `tenants.theme_config` (jsonb)
- `site-profile.ts` becomes schema/defaults; runtime values from active tenant
- Inject brand colors as CSS variables in tenant layout `<head>`
- Theme fields:
  - Brand name, logo url, favicon url
  - Color tokens (override vanailaNavy, electricBlue, royalPurple, vibrantCyan, deepSlate)
  - Nav items, footer links
  - Social handles
  - SEO defaults (og image, twitter handle)

---

### Phase C-7 - Tenant-Aware Infra Files

- `app/sitemap.ts` - read host, return only that tenant's URLs
- `app/robots.ts` - tenant-specific
- `features/cms/seo.ts` - accept `tenant.baseUrl` (from custom_domain or rootDomain/slug)

---

### Phase C-8 - Custom Domains (Caddy On-Demand TLS)

- Add `app/api/internal/verify-domain/route.ts`: returns 200 if host matches a tenant's `custom_domain`, 404 otherwise (Caddy's `on_demand_tls.ask` endpoint)
- Provide `Caddyfile` example in `docs/multi-tenant-deployment.md`
- Admin UI: "Add custom domain" - store domain, show CNAME instructions, background-poll DNS via BullMQ, mark verified, invalidate host cache

---

### Phase C-9 - Tenant Create Script

- New script: `npm run tenant:create -- --slug acme --name "Acme Co" --admin-email x@y.com`
- Inserts tenant row, seeds default pages/content, creates first tenant admin
- Keep existing `bootstrap:client` for fork workflow (untouched)

---

## Part D: Deployment

### Docker Compose (local dev + prod)

Services:
- `app` - Next.js standalone (port 3000)
- `postgres` - PostgreSQL 16 (port 5432)
- `redis` - Redis 7 (port 6379)
- `minio` - MinIO (ports 9000, 9001)
- `caddy` - Caddy reverse proxy (ports 80, 443)

### Production VPS layout

```
/opt/multiweb/
  docker-compose.yml
  Caddyfile
  .env
  data/
    postgres/
    redis/
    minio/
```

### Tasks

- [ ] Create `docker-compose.yml` for local dev (Postgres + Redis + MinIO)
- [ ] Create `docker-compose.prod.yml` (adds Caddy, uses standalone Next.js image)
- [ ] Create `Dockerfile` for Next.js standalone build
- [ ] Create `Caddyfile` with on-demand TLS config
- [ ] Document deployment in `docs/multi-tenant-deployment.md`

---

## Execution Order

| Phase | Description | Risk | Dependencies |
|-------|-------------|------|--------------|
| B-1 | Remove Supabase, unify S3 storage | Low | None |
| B-2 | Redis rate limiting | Low | None |
| B-3 | Redis session fallback | Low | B-2 |
| B-4 | Clean up DB connection | Low | B-1 |
| C-1 | Schema + migration | Medium | B-4 |
| C-2a | Tenant context helper | Low | C-1 |
| C-2b | Middleware + routing | High | C-2a |
| C-3 | Store refactor (factory) | High | C-2a |
| C-4 | Admin scoping | Medium | C-3 |
| C-5 | Cache scoping | Low | C-3, B-2 |
| C-6 | Per-tenant theming | Medium | C-4 |
| C-7 | Tenant-aware infra files | Low | C-3 |
| C-8 | Custom domains (Caddy) | Medium | C-2b |
| C-9 | Tenant create script | Low | C-4 |
| D | Docker + deployment | Low | All above |

---

## Working Agreement

- Run `npm run check` (lint + typecheck + test) after every phase. Do not move forward if it fails.
- For schema changes, show generated migration SQL before running `db:migrate`.
- If ambiguity is found, ask before guessing. Do not invent fields or routes not approved.
- No em dashes in code comments or docs.
- For each phase, end with: (a) summary of what changed, (b) files touched, (c) what to test manually, (d) wait for "next" from user.
