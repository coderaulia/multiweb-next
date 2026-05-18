import { DEFAULT_TENANT_ID } from '@/db/tenantConstants';

import {
  resolveBlogPostAssetUrls,
  resolveCmsContentAssetUrls,
  resolveLandingPageAssetUrls,
  resolveMediaAssetUrls,
  resolvePortfolioProjectAssetUrls,
  resolveSettingsAssetUrls
} from './assetUrls';
import { getStore, readRawCmsContent, writeRawCmsContent } from './storeAdapter';
import type {
  BlogPost,
  Category,
  CmsContent,
  LandingPage,
  MediaAsset,
  PageId,
  PortfolioProject,
  SiteSettings
} from './types';
import type { BlogQueryInput, PortfolioQueryInput } from './storeTypes';

export async function readContent(): Promise<CmsContent> {
  return resolveCmsContentAssetUrls(await readRawCmsContent());
}

export async function writeContent(content: CmsContent): Promise<void> {
  await writeRawCmsContent(content);
}

export async function getSettings(tenantId: string = DEFAULT_TENANT_ID) {
  const settings = await getStore(tenantId).getSettings();
  return resolveSettingsAssetUrls(settings);
}

export async function updateSettings(settings: SiteSettings, tenantId: string = DEFAULT_TENANT_ID): Promise<SiteSettings> {
  return getStore(tenantId).updateSettings(settings);
}

export async function getPages(tenantId: string = DEFAULT_TENANT_ID) {
  const pages = await getStore(tenantId).getPages();
  return Object.fromEntries(
    Object.entries(pages).map(([id, page]) => [id, resolveLandingPageAssetUrls(page)])
  ) as Record<PageId, LandingPage>;
}

export async function getPageById(id: PageId, tenantId: string = DEFAULT_TENANT_ID): Promise<LandingPage | null> {
  const page = await getStore(tenantId).getPageById(id);
  return page ? resolveLandingPageAssetUrls(page) : null;
}

export async function upsertPage(page: LandingPage, tenantId: string = DEFAULT_TENANT_ID): Promise<LandingPage> {
  return getStore(tenantId).upsertPage(page);
}

export async function getBlogPosts(includeDrafts = false, tenantId: string = DEFAULT_TENANT_ID): Promise<BlogPost[]> {
  const posts = await getStore(tenantId).getBlogPosts(includeDrafts);
  return posts.map(resolveBlogPostAssetUrls);
}

export type { BlogQueryInput, PortfolioQueryInput } from './storeTypes';

export async function queryBlogPosts(input: BlogQueryInput, tenantId: string = DEFAULT_TENANT_ID) {
  const payload = await getStore(tenantId).queryBlogPosts(input);
  return { ...payload, posts: payload.posts.map(resolveBlogPostAssetUrls) };
}

export async function getBlogPostById(id: string, tenantId: string = DEFAULT_TENANT_ID): Promise<BlogPost | null> {
  const post = await getStore(tenantId).getBlogPostById(id);
  return post ? resolveBlogPostAssetUrls(post) : null;
}

export async function getBlogPostBySlug(slug: string, tenantId: string = DEFAULT_TENANT_ID): Promise<BlogPost | null> {
  const post = await getStore(tenantId).getBlogPostBySlug(slug);
  return post ? resolveBlogPostAssetUrls(post) : null;
}

export async function createBlogPost(payload?: Partial<BlogPost>, tenantId: string = DEFAULT_TENANT_ID): Promise<BlogPost> {
  return getStore(tenantId).createBlogPost(payload);
}

export async function updateBlogPost(id: string, payload: BlogPost, tenantId: string = DEFAULT_TENANT_ID): Promise<BlogPost | null> {
  return getStore(tenantId).updateBlogPost(id, payload);
}

export async function deleteBlogPost(id: string, tenantId: string = DEFAULT_TENANT_ID): Promise<boolean> {
  return getStore(tenantId).deleteBlogPost(id);
}

export async function setPostStatus(id: string, status: 'draft' | 'published', tenantId: string = DEFAULT_TENANT_ID): Promise<BlogPost | null> {
  return getStore(tenantId).setPostStatus(id, status);
}

export async function getPortfolioProjects(includeDrafts = false, tenantId: string = DEFAULT_TENANT_ID): Promise<PortfolioProject[]> {
  const projects = await getStore(tenantId).getPortfolioProjects(includeDrafts);
  return projects.map(resolvePortfolioProjectAssetUrls);
}

export async function queryPortfolioProjects(input: PortfolioQueryInput, tenantId: string = DEFAULT_TENANT_ID) {
  const payload = await getStore(tenantId).queryPortfolioProjects(input);
  return { ...payload, projects: payload.projects.map(resolvePortfolioProjectAssetUrls) };
}

export async function getPortfolioProjectById(id: string, tenantId: string = DEFAULT_TENANT_ID): Promise<PortfolioProject | null> {
  const project = await getStore(tenantId).getPortfolioProjectById(id);
  return project ? resolvePortfolioProjectAssetUrls(project) : null;
}

export async function getPortfolioProjectBySlug(slug: string, tenantId: string = DEFAULT_TENANT_ID): Promise<PortfolioProject | null> {
  const project = await getStore(tenantId).getPortfolioProjectBySlug(slug);
  return project ? resolvePortfolioProjectAssetUrls(project) : null;
}

export async function createPortfolioProject(payload?: Partial<PortfolioProject>, tenantId: string = DEFAULT_TENANT_ID): Promise<PortfolioProject> {
  return getStore(tenantId).createPortfolioProject(payload);
}

export async function updatePortfolioProject(id: string, payload: PortfolioProject, tenantId: string = DEFAULT_TENANT_ID): Promise<PortfolioProject | null> {
  return getStore(tenantId).updatePortfolioProject(id, payload);
}

export async function deletePortfolioProject(id: string, tenantId: string = DEFAULT_TENANT_ID): Promise<boolean> {
  return getStore(tenantId).deletePortfolioProject(id);
}

export async function reorderPortfolioProjects(orderedIds: string[], tenantId: string = DEFAULT_TENANT_ID): Promise<{ updated: number }> {
  return getStore(tenantId).reorderPortfolioProjects(orderedIds);
}

export async function setPortfolioProjectStatus(id: string, status: 'draft' | 'published', tenantId: string = DEFAULT_TENANT_ID): Promise<PortfolioProject | null> {
  return getStore(tenantId).setPortfolioProjectStatus(id, status);
}

export async function getCategories(tenantId: string = DEFAULT_TENANT_ID): Promise<Category[]> {
  return getStore(tenantId).getCategories();
}

export async function getCategoryById(id: string, tenantId: string = DEFAULT_TENANT_ID): Promise<Category | null> {
  return getStore(tenantId).getCategoryById(id);
}

export async function createCategory(payload: Category, tenantId: string = DEFAULT_TENANT_ID): Promise<Category> {
  return getStore(tenantId).createCategory(payload);
}

export async function updateCategory(id: string, payload: Category, tenantId: string = DEFAULT_TENANT_ID): Promise<Category | null> {
  return getStore(tenantId).updateCategory(id, payload);
}

export async function deleteCategory(id: string, tenantId: string = DEFAULT_TENANT_ID): Promise<boolean> {
  return getStore(tenantId).deleteCategory(id);
}

export async function getMediaAssets(tenantId: string = DEFAULT_TENANT_ID): Promise<MediaAsset[]> {
  const mediaAssets = await getStore(tenantId).getMediaAssets();
  return mediaAssets.map(resolveMediaAssetUrls);
}

export async function getMediaAssetById(id: string, tenantId: string = DEFAULT_TENANT_ID): Promise<MediaAsset | null> {
  const mediaAsset = await getStore(tenantId).getMediaAssetById(id);
  return mediaAsset ? resolveMediaAssetUrls(mediaAsset) : null;
}

export async function createMediaAsset(payload: MediaAsset, tenantId: string = DEFAULT_TENANT_ID): Promise<MediaAsset> {
  return getStore(tenantId).createMediaAsset(payload);
}

export async function updateMediaAsset(id: string, payload: MediaAsset, tenantId: string = DEFAULT_TENANT_ID): Promise<MediaAsset | null> {
  return getStore(tenantId).updateMediaAsset(id, payload);
}

export async function deleteMediaAsset(id: string, tenantId: string = DEFAULT_TENANT_ID): Promise<boolean> {
  return getStore(tenantId).deleteMediaAsset(id);
}
