import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';

import { DEFAULT_TENANT_ID } from '@/db/tenantConstants';

import type { LandingPage, PageId } from './types';
import * as contentStore from './contentStore';
import { isPageLive } from './publicationState';

// ---------------------------------------------------------------------------
// Cache tag helpers
// ---------------------------------------------------------------------------

/** Build tenant-scoped cache tags so each tenant gets an independent cache. */
export function tenantTags(tenantId: string) {
  return {
    all: `cms:${tenantId}`,
    settings: `cms:${tenantId}:settings`,
    pages: `cms:${tenantId}:pages`,
    blog: `cms:${tenantId}:blog`,
    portfolio: `cms:${tenantId}:portfolio`,
    media: `cms:${tenantId}:media`
  } as const;
}

/** Legacy global tags kept for backward compat with existing revalidation calls. */
export const cmsPublicCacheTags = tenantTags(DEFAULT_TENANT_ID);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function withCommonTags(tenantId: string, ...extra: string[]) {
  const t = tenantTags(tenantId);
  return Array.from(new Set([t.all, ...extra]));
}

function isCacheRuntimeUnavailable(error: unknown) {
  return (
    error instanceof Error &&
    /incrementalCache missing|static generation store missing/i.test(error.message)
  );
}

async function withCacheFallback<T>(cached: () => Promise<T>, uncached: () => Promise<T>) {
  try {
    return await cached();
  } catch (error) {
    if (isCacheRuntimeUnavailable(error)) {
      return uncached();
    }
    throw error;
  }
}

function safelyRevalidate(action: () => void) {
  try {
    action();
  } catch (error) {
    if (!isCacheRuntimeUnavailable(error)) {
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Data readers (used as unstable_cache callbacks)
// ---------------------------------------------------------------------------

// 60-second TTL ensures scheduled publish/unpublish takes effect without a
// cron job — content is re-checked at most once per minute automatically.
const SCHEDULED_CONTENT_TTL = 60;

async function readPublishedPages(tenantId: string) {
  const pages = await contentStore.getPages(tenantId);
  return Object.values(pages).filter((page) => isPageLive(page));
}

async function readPublishedPageById(id: PageId, tenantId: string): Promise<LandingPage | null> {
  const page = await contentStore.getPageById(id, tenantId);
  if (!page || !isPageLive(page)) return null;
  return page;
}

async function readPublishedPageBySlug(slug: string, tenantId: string): Promise<LandingPage | null> {
  const normalized = slug.trim().replace(/^\/+/, '').toLowerCase();
  const pages = await readPublishedPages(tenantId);
  return pages.find((page) => page.seo.slug.toLowerCase() === normalized) ?? null;
}

// ---------------------------------------------------------------------------
// Tenant-scoped unstable_cache instances
// Each unstable_cache key includes tenantId so caches are isolated.
// ---------------------------------------------------------------------------

// We cannot close over tenantId inside unstable_cache factories at module
// load time, so we create them lazily per-call using the (tenantId, slug)
// as part of the cache key array.

const getCachedSiteSettings = unstable_cache(
  (tenantId: string) => contentStore.getSettings(tenantId),
  ['cms-settings'],
  { tags: [cmsPublicCacheTags.all], revalidate: SCHEDULED_CONTENT_TTL }
);

const getCachedPublishedPages = unstable_cache(
  (tenantId: string) => readPublishedPages(tenantId),
  ['cms-pages'],
  { tags: [cmsPublicCacheTags.all], revalidate: SCHEDULED_CONTENT_TTL }
);

const getCachedPublishedPageById = unstable_cache(
  (id: PageId, tenantId: string) => readPublishedPageById(id, tenantId),
  ['cms-page-by-id'],
  { tags: [cmsPublicCacheTags.all], revalidate: SCHEDULED_CONTENT_TTL }
);

const getCachedPublishedPageBySlug = unstable_cache(
  (slug: string, tenantId: string) => readPublishedPageBySlug(slug, tenantId),
  ['cms-page-by-slug'],
  { tags: [cmsPublicCacheTags.all], revalidate: SCHEDULED_CONTENT_TTL }
);

const getCachedPublishedBlogPosts = unstable_cache(
  (tenantId: string) => contentStore.getBlogPosts(false, tenantId),
  ['cms-blog-posts'],
  { tags: [cmsPublicCacheTags.all], revalidate: SCHEDULED_CONTENT_TTL }
);

const getCachedPublishedBlogPostBySlug = unstable_cache(
  (slug: string, tenantId: string) => contentStore.getBlogPostBySlug(slug, tenantId),
  ['cms-blog-post-by-slug'],
  { tags: [cmsPublicCacheTags.all], revalidate: SCHEDULED_CONTENT_TTL }
);

const getCachedPublishedPortfolioProjects = unstable_cache(
  (tenantId: string) => contentStore.getPortfolioProjects(false, tenantId),
  ['cms-portfolio-projects'],
  { tags: [cmsPublicCacheTags.all], revalidate: SCHEDULED_CONTENT_TTL }
);

const getCachedPublishedPortfolioProjectBySlug = unstable_cache(
  (slug: string, tenantId: string) => contentStore.getPortfolioProjectBySlug(slug, tenantId),
  ['cms-portfolio-project-by-slug'],
  { tags: [cmsPublicCacheTags.all], revalidate: SCHEDULED_CONTENT_TTL }
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getCachedPublicSiteSettings(tenantId: string = DEFAULT_TENANT_ID) {
  return withCacheFallback(
    () => getCachedSiteSettings(tenantId),
    () => contentStore.getSettings(tenantId)
  );
}

export function getCachedPublicPages(tenantId: string = DEFAULT_TENANT_ID) {
  return withCacheFallback(
    () => getCachedPublishedPages(tenantId),
    () => readPublishedPages(tenantId)
  );
}

export function getCachedPublicPageById(id: PageId, tenantId: string = DEFAULT_TENANT_ID) {
  return withCacheFallback(
    () => getCachedPublishedPageById(id, tenantId),
    () => readPublishedPageById(id, tenantId)
  );
}

export function getCachedPublicPageBySlug(slug: string, tenantId: string = DEFAULT_TENANT_ID) {
  return withCacheFallback(
    () => getCachedPublishedPageBySlug(slug, tenantId),
    () => readPublishedPageBySlug(slug, tenantId)
  );
}

export function getCachedPublicBlogPosts(tenantId: string = DEFAULT_TENANT_ID) {
  return withCacheFallback(
    () => getCachedPublishedBlogPosts(tenantId),
    () => contentStore.getBlogPosts(false, tenantId)
  );
}

export function getCachedPublicBlogPostBySlug(slug: string, tenantId: string = DEFAULT_TENANT_ID) {
  return withCacheFallback(
    () => getCachedPublishedBlogPostBySlug(slug, tenantId),
    () => contentStore.getBlogPostBySlug(slug, tenantId)
  );
}

export function getCachedPublicPortfolioProjects(tenantId: string = DEFAULT_TENANT_ID) {
  return withCacheFallback(
    () => getCachedPublishedPortfolioProjects(tenantId),
    () => contentStore.getPortfolioProjects(false, tenantId)
  );
}

export function getCachedPublicPortfolioProjectBySlug(slug: string, tenantId: string = DEFAULT_TENANT_ID) {
  return withCacheFallback(
    () => getCachedPublishedPortfolioProjectBySlug(slug, tenantId),
    () => contentStore.getPortfolioProjectBySlug(slug, tenantId)
  );
}

// ---------------------------------------------------------------------------
// Revalidation helpers (C-5 preparation: tenant-scoped tags)
// ---------------------------------------------------------------------------

export function revalidateBlogCache(tenantId: string = DEFAULT_TENANT_ID) {
  const tags = tenantTags(tenantId);
  safelyRevalidate(() => revalidateTag(tags.blog, {}));
  safelyRevalidate(() => revalidateTag(tags.all, {}));
  safelyRevalidate(() => revalidatePath('/sitemap.xml'));
}

export function revalidatePortfolioCache(tenantId: string = DEFAULT_TENANT_ID) {
  const tags = tenantTags(tenantId);
  safelyRevalidate(() => revalidateTag(tags.portfolio, {}));
  safelyRevalidate(() => revalidateTag(tags.all, {}));
  safelyRevalidate(() => revalidatePath('/sitemap.xml'));
}

export function revalidatePagesCache(tenantId: string = DEFAULT_TENANT_ID) {
  const tags = tenantTags(tenantId);
  safelyRevalidate(() => revalidateTag(tags.pages, {}));
  safelyRevalidate(() => revalidateTag(tags.all, {}));
  safelyRevalidate(() => revalidatePath('/sitemap.xml'));
  safelyRevalidate(() => revalidatePath('/robots.txt'));
}

export function revalidateSettingsCache(tenantId: string = DEFAULT_TENANT_ID) {
  const tags = tenantTags(tenantId);
  safelyRevalidate(() => revalidateTag(tags.settings, {}));
  safelyRevalidate(() => revalidateTag(tags.media, {}));
  safelyRevalidate(() => revalidateTag(tags.all, {}));
  safelyRevalidate(() => revalidatePath('/sitemap.xml'));
  safelyRevalidate(() => revalidatePath('/robots.txt'));
}

/** Full-site blast for a tenant — use only for import/restore operations. */
export function revalidatePublicCmsCache(tenantId: string = DEFAULT_TENANT_ID) {
  const tags = tenantTags(tenantId);
  for (const tag of Object.values(tags)) {
    safelyRevalidate(() => revalidateTag(tag, {}));
  }
  safelyRevalidate(() => revalidatePath('/sitemap.xml'));
  safelyRevalidate(() => revalidatePath('/robots.txt'));
}
