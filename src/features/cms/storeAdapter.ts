import { DEFAULT_TENANT_ID } from '@/db/tenantConstants';
import { env } from '@/services/env';

import * as dbCollectionsStore from './dbCollectionsStore';
import * as dbStore from './dbStore';
import type { BlogPost, Category, CmsContent, LandingPage, MediaAsset, PageId, PortfolioProject, SiteSettings } from './types';
import type { BlogQueryInput, PortfolioQueryInput } from './storeTypes';

type FileContentStore = typeof import('./fileStore');
type FileCollectionsStore = typeof import('./fileCollectionsStore');

export type CmsStoreModules =
  | {
      mode: 'database';
      contentStore: typeof dbStore;
      collectionsStore: typeof dbCollectionsStore;
    }
  | {
      mode: 'file';
      contentStore: FileContentStore;
      collectionsStore: FileCollectionsStore;
    };

export function isDatabaseMode() {
  return Boolean(env.databaseUrl);
}

let cachedModules: CmsStoreModules | null = null;

export async function loadCmsStoreModules(): Promise<CmsStoreModules> {
  if (cachedModules) return cachedModules;

  if (isDatabaseMode()) {
    cachedModules = { mode: 'database', contentStore: dbStore, collectionsStore: dbCollectionsStore };
    return cachedModules;
  }

  const [contentStore, collectionsStore] = await Promise.all([
    import('./fileStore'),
    import('./fileCollectionsStore')
  ]);

  cachedModules = { mode: 'file', contentStore, collectionsStore };
  return cachedModules;
}

/**
 * Like loadCmsStoreModules but asserts/narrows to file mode.
 * Used inside the file-mode branch of getStore so TypeScript knows
 * the contentStore / collectionsStore types are the file-based ones.
 */
async function loadFileModeModules() {
  const stores = await loadCmsStoreModules();
  return stores as Extract<CmsStoreModules, { mode: 'file' }>;
}

// ---------------------------------------------------------------------------
// Tenant-scoped factory
// ---------------------------------------------------------------------------

/**
 * Returns a tenant-scoped store instance. Every read and write operation is
 * automatically filtered by the given tenantId.
 *
 * In file mode (single-tenant fork) the tenantId is ignored; all operations
 * fall through to the file-based store.
 */
export function getStore(tenantId: string) {
  if (!isDatabaseMode()) {
    // File-mode: lazily import and delegate (tenantId is meaningless here)
    return {
      // Settings
      getSettings: async () => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.getSettings();
      },
      updateSettings: async (settings: SiteSettings) => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.updateSettings(settings);
      },
      // Pages
      getPages: async () => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.getPages();
      },
      getPageById: async (id: PageId) => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.getPageById(id);
      },
      upsertPage: async (page: LandingPage) => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.upsertPage(page);
      },
      // Blog
      getBlogPosts: async (includeDrafts = false) => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.getBlogPosts(includeDrafts);
      },
      queryBlogPosts: async (input: BlogQueryInput) => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.queryBlogPosts(input);
      },
      getBlogPostById: async (id: string) => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.getBlogPostById(id);
      },
      getBlogPostBySlug: async (slug: string) => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.getBlogPostBySlug(slug);
      },
      createBlogPost: async (payload?: Partial<BlogPost>) => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.createBlogPost(payload);
      },
      updateBlogPost: async (id: string, payload: BlogPost) => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.updateBlogPost(id, payload);
      },
      deleteBlogPost: async (id: string) => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.deleteBlogPost(id);
      },
      setPostStatus: async (id: string, status: 'draft' | 'published') => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.setPostStatus(id, status);
      },
      // Portfolio
      getPortfolioProjects: async (includeDrafts = false) => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.getPortfolioProjects(includeDrafts);
      },
      queryPortfolioProjects: async (input: PortfolioQueryInput) => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.queryPortfolioProjects(input);
      },
      getPortfolioProjectById: async (id: string) => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.getPortfolioProjectById(id);
      },
      getPortfolioProjectBySlug: async (slug: string) => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.getPortfolioProjectBySlug(slug);
      },
      createPortfolioProject: async (payload?: Partial<PortfolioProject>) => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.createPortfolioProject(payload);
      },
      updatePortfolioProject: async (id: string, payload: PortfolioProject) => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.updatePortfolioProject(id, payload);
      },
      deletePortfolioProject: async (id: string) => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.deletePortfolioProject(id);
      },
      setPortfolioProjectStatus: async (id: string, status: 'draft' | 'published') => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.setPortfolioProjectStatus(id, status);
      },
      reorderPortfolioProjects: async (orderedIds: string[]) => {
        const { contentStore } = await loadFileModeModules();
        return contentStore.reorderPortfolioProjects(orderedIds);
      },
      // Collections
      getCategories: async () => {
        const { collectionsStore } = await loadFileModeModules();
        return collectionsStore.getCategories();
      },
      getCategoryById: async (id: string) => {
        const { collectionsStore } = await loadFileModeModules();
        return collectionsStore.getCategoryById(id);
      },
      createCategory: async (payload: Category) => {
        const { collectionsStore } = await loadFileModeModules();
        return collectionsStore.createCategory(payload);
      },
      updateCategory: async (id: string, payload: Category) => {
        const { collectionsStore } = await loadFileModeModules();
        return collectionsStore.updateCategory(id, payload);
      },
      deleteCategory: async (id: string) => {
        const { collectionsStore } = await loadFileModeModules();
        return collectionsStore.deleteCategory(id);
      },
      getMediaAssets: async () => {
        const { collectionsStore } = await loadFileModeModules();
        return collectionsStore.getMediaAssets();
      },
      getMediaAssetById: async (id: string) => {
        const { collectionsStore } = await loadFileModeModules();
        return collectionsStore.getMediaAssetById(id);
      },
      createMediaAsset: async (payload: MediaAsset) => {
        const { collectionsStore } = await loadFileModeModules();
        return collectionsStore.createMediaAsset(payload);
      },
      updateMediaAsset: async (id: string, payload: MediaAsset) => {
        const { collectionsStore } = await loadFileModeModules();
        return collectionsStore.updateMediaAsset(id, payload);
      },
      deleteMediaAsset: async (id: string) => {
        const { collectionsStore } = await loadFileModeModules();
        return collectionsStore.deleteMediaAsset(id);
      }
    };
  }

  // Database mode: all calls scoped by tenantId
  return {
    getSettings: () => dbStore.getSettings(tenantId),
    updateSettings: (settings: SiteSettings) => dbStore.updateSettings(settings, tenantId),
    getPages: () => dbStore.getPages(tenantId),
    getPageById: (id: PageId) => dbStore.getPageById(id, tenantId),
    upsertPage: (page: LandingPage) => dbStore.upsertPage(page, tenantId),
    getBlogPosts: (includeDrafts = false) => dbStore.getBlogPosts(includeDrafts, tenantId),
    queryBlogPosts: (input: BlogQueryInput) => dbStore.queryBlogPosts(input, tenantId),
    getBlogPostById: (id: string) => dbStore.getBlogPostById(id, tenantId),
    getBlogPostBySlug: (slug: string) => dbStore.getBlogPostBySlug(slug, tenantId),
    createBlogPost: (payload?: Partial<BlogPost>) => dbStore.createBlogPost(payload, tenantId),
    updateBlogPost: (id: string, payload: BlogPost) => dbStore.updateBlogPost(id, payload, tenantId),
    deleteBlogPost: (id: string) => dbStore.deleteBlogPost(id, tenantId),
    setPostStatus: (id: string, status: 'draft' | 'published') => dbStore.setPostStatus(id, status, tenantId),
    getPortfolioProjects: (includeDrafts = false) => dbStore.getPortfolioProjects(includeDrafts, tenantId),
    queryPortfolioProjects: (input: PortfolioQueryInput) => dbStore.queryPortfolioProjects(input, tenantId),
    getPortfolioProjectById: (id: string) => dbStore.getPortfolioProjectById(id, tenantId),
    getPortfolioProjectBySlug: (slug: string) => dbStore.getPortfolioProjectBySlug(slug, tenantId),
    createPortfolioProject: (payload?: Partial<PortfolioProject>) => dbStore.createPortfolioProject(payload, tenantId),
    updatePortfolioProject: (id: string, payload: PortfolioProject) => dbStore.updatePortfolioProject(id, payload, tenantId),
    deletePortfolioProject: (id: string) => dbStore.deletePortfolioProject(id, tenantId),
    setPortfolioProjectStatus: (id: string, status: 'draft' | 'published') => dbStore.setPortfolioProjectStatus(id, status, tenantId),
    reorderPortfolioProjects: (orderedIds: string[]) => dbStore.reorderPortfolioProjects(orderedIds, tenantId),
    getCategories: () => dbCollectionsStore.getCategories(tenantId),
    getCategoryById: (id: string) => dbCollectionsStore.getCategoryById(id, tenantId),
    createCategory: (payload: Category) => dbCollectionsStore.createCategory(payload, tenantId),
    updateCategory: (id: string, payload: Category) => dbCollectionsStore.updateCategory(id, payload, tenantId),
    deleteCategory: (id: string) => dbCollectionsStore.deleteCategory(id, tenantId),
    getMediaAssets: () => dbCollectionsStore.getMediaAssets(tenantId),
    getMediaAssetById: (id: string) => dbCollectionsStore.getMediaAssetById(id, tenantId),
    createMediaAsset: (payload: MediaAsset) => dbCollectionsStore.createMediaAsset(payload, tenantId),
    updateMediaAsset: (id: string, payload: MediaAsset) => dbCollectionsStore.updateMediaAsset(id, payload, tenantId),
    deleteMediaAsset: (id: string) => dbCollectionsStore.deleteMediaAsset(id, tenantId)
  };
}

/** Convenience: get a store for the default tenant (used by import/seed scripts). */
export function getDefaultStore() {
  return getStore(DEFAULT_TENANT_ID);
}

// ---------------------------------------------------------------------------
// Raw content read/write (used by import/export, unchanged)
// ---------------------------------------------------------------------------

export async function readRawCmsContent(): Promise<CmsContent> {
  const stores = await loadCmsStoreModules();
  if (stores.mode === 'file') {
    return stores.contentStore.readContent();
  }

  const [settings, pages, blogPosts, portfolioProjects, categories, mediaAssets] = await Promise.all([
    stores.contentStore.getSettings(DEFAULT_TENANT_ID),
    stores.contentStore.getPages(DEFAULT_TENANT_ID),
    stores.contentStore.getBlogPosts(true, DEFAULT_TENANT_ID),
    stores.contentStore.getPortfolioProjects(true, DEFAULT_TENANT_ID),
    stores.collectionsStore.getCategories(DEFAULT_TENANT_ID),
    stores.collectionsStore.getMediaAssets(DEFAULT_TENANT_ID)
  ]);

  return { settings, pages, blogPosts, portfolioProjects, categories, mediaAssets };
}

export async function writeRawCmsContent(content: CmsContent): Promise<void> {
  const stores = await loadCmsStoreModules();
  if (stores.mode === 'file') {
    await stores.contentStore.writeContent(content);
    return;
  }

  await stores.contentStore.replaceAllCmsContent(content, DEFAULT_TENANT_ID);
}
