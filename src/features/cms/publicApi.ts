import { DEFAULT_TENANT_ID } from '@/db/tenantConstants';

import {
  getCachedPublicBlogPostBySlug,
  getCachedPublicBlogPosts,
  getCachedPublicPageById,
  getCachedPublicPageBySlug,
  getCachedPublicPages,
  getCachedPublicPortfolioProjectBySlug,
  getCachedPublicPortfolioProjects,
  getCachedPublicSiteSettings
} from './publicCache';
import * as contentStore from './contentStore';
import type { LandingPage, PageId } from './types';

export async function getSiteSettings(tenantId: string = DEFAULT_TENANT_ID) {
  return getCachedPublicSiteSettings(tenantId);
}

export async function getPublishedPage(id: PageId, tenantId: string = DEFAULT_TENANT_ID): Promise<LandingPage | null> {
  return getCachedPublicPageById(id, tenantId);
}

export async function getPublishedPages(tenantId: string = DEFAULT_TENANT_ID) {
  return getCachedPublicPages(tenantId);
}

export async function getPublishedPageBySlug(slug: string, tenantId: string = DEFAULT_TENANT_ID): Promise<LandingPage | null> {
  return getCachedPublicPageBySlug(slug, tenantId);
}

export async function getPublishedBlogPosts(tenantId: string = DEFAULT_TENANT_ID) {
  return getCachedPublicBlogPosts(tenantId);
}

export async function getPublishedBlogPostBySlug(slug: string, tenantId: string = DEFAULT_TENANT_ID) {
  return getCachedPublicBlogPostBySlug(slug, tenantId);
}

export async function getPublishedPortfolioProjects(tenantId: string = DEFAULT_TENANT_ID) {
  return getCachedPublicPortfolioProjects(tenantId);
}

export async function getPublishedPortfolioProjectBySlug(slug: string, tenantId: string = DEFAULT_TENANT_ID) {
  return getCachedPublicPortfolioProjectBySlug(slug, tenantId);
}

export async function getPreviewPageBySlug(slug: string, tenantId: string = DEFAULT_TENANT_ID): Promise<LandingPage | null> {
  const normalized = slug.trim().replace(/^\/+/, '').toLowerCase();
  const pages = Object.values(await contentStore.getPages(tenantId));
  return pages.find((page) => page.seo.slug.toLowerCase() === normalized) ?? null;
}

export async function getPreviewBlogPostBySlug(slug: string, tenantId: string = DEFAULT_TENANT_ID) {
  const normalized = slug.trim().replace(/^\/+/, '').toLowerCase();
  const posts = await contentStore.getBlogPosts(true, tenantId);
  return posts.find((post) => post.seo.slug.toLowerCase() === normalized) ?? null;
}

export async function getPreviewPortfolioProjectBySlug(slug: string, tenantId: string = DEFAULT_TENANT_ID) {
  const normalized = slug.trim().replace(/^\/+/, '').toLowerCase();
  const projects = await contentStore.getPortfolioProjects(true, tenantId);
  return projects.find((project) => project.seo.slug.toLowerCase() === normalized) ?? null;
}

export async function getPreviewPages(tenantId: string = DEFAULT_TENANT_ID) {
  return Object.values(await contentStore.getPages(tenantId));
}

export async function getPreviewBlogPosts(tenantId: string = DEFAULT_TENANT_ID) {
  return contentStore.getBlogPosts(true, tenantId);
}

export async function getPreviewPortfolioProjects(tenantId: string = DEFAULT_TENANT_ID) {
  return contentStore.getPortfolioProjects(true, tenantId);
}
