/**
 * Default content loader.
 *
 * Content data lives in defaultContent.json to avoid embedding large inline
 * string literals in the TypeScript bundle. Call getDefaultContent() to
 * obtain a deep-cloned, runtime-hydrated copy of the defaults.
 */

import { createRequire } from 'node:module';

import type { CmsContent } from './types';

const _require = createRequire(import.meta.url);
const nowIso = () => new Date().toISOString();

let _cache: CmsContent | null = null;

/**
 * Load default content lazily. The JSON file is parsed once and cached in
 * memory. Each call returns a fresh deep clone so callers can mutate freely.
 */
export function getDefaultContent(): CmsContent {
  if (!_cache) {
    const raw = _require('./defaultContent.json') as CmsContent;

    // Hydrate dynamic values that cannot be stored in JSON
    const now = nowIso();
    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim() || 'http://localhost:3000';
    const adminEmail = (process.env.CMS_ADMIN_EMAIL ?? '').trim() || 'hello@example.com';
    const orgName = (process.env.CMS_ORG_NAME ?? '').trim() || raw.settings.organizationName || raw.settings.general.siteName;
    const orgLogo = (process.env.CMS_ORG_LOGO ?? '').trim() || '';

    _cache = {
      ...raw,
      settings: {
        ...raw.settings,
        general: {
          ...raw.settings.general,
          baseUrl,
          adminEmail,
          timezone: (process.env.CMS_TIMEZONE ?? '').trim() || raw.settings.general.timezone
        },
        baseUrl,
        organizationName: orgName,
        organizationLogo: orgLogo
      },
      // Re-stamp timestamps so seeded records have consistent creation times
      blogPosts: raw.blogPosts.map((post) => ({
        ...post,
        publishedAt: post.publishedAt ? now : null,
        updatedAt: now
      })),
      portfolioProjects: raw.portfolioProjects.map((project) => ({
        ...project,
        publishedAt: project.publishedAt ? now : null,
        updatedAt: now
      })),
      categories: raw.categories.map((category) => ({
        ...category,
        createdAt: now,
        updatedAt: now
      })),
      mediaAssets: raw.mediaAssets.map((asset) => ({
        ...asset,
        createdAt: now,
        updatedAt: now
      }))
    };
  }

  return structuredClone(_cache);
}
