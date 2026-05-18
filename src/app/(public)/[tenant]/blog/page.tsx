import { BlogPageView } from '@/components/pages/BlogPageView';
import { buildMetadata } from '@/features/cms/seo';
import { getPublishedBlogPosts, getSiteSettings } from '@/features/cms/publicApi';
import { resolveTenantBySlug } from '@/features/cms/tenantContext';

type BlogListPageProps = {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{
    q?: string;
    tag?: string;
    page?: string;
  }>;
};

export async function generateMetadata({ params }: BlogListPageProps) {
  const { tenant: tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  const settings = await getSiteSettings(tenant?.id);
  return buildMetadata(
    settings,
    {
      metaTitle: 'Insights | Web Development, SEO, and Digital Growth Resources',
      metaDescription: 'Actionable insights on website performance, SEO, custom software, and digital growth strategy for modern businesses.',
      slug: 'blog',
      canonical: '',
      socialImage: settings.defaultOgImage,
      noIndex: false,
      keywords: ['web development insights', 'technical seo', 'digital growth strategy', 'custom software']
    },
    'Insights | Web Development, SEO, and Digital Growth Resources',
    'Actionable insights on website performance, SEO, custom software, and digital growth strategy for modern businesses.'
  );
}

export default async function TenantBlogListPage({ params: paramsPromise, searchParams }: BlogListPageProps) {
  const { tenant: tenantSlug } = await paramsPromise;
  const tenant = await resolveTenantBySlug(tenantSlug);
  const [params, settings, posts] = await Promise.all([
    searchParams,
    getSiteSettings(tenant?.id),
    getPublishedBlogPosts(tenant?.id)
  ]);
  const query = params.q ?? '';
  const activeTag = params.tag ?? 'all';
  const page = Number.parseInt(params.page ?? '1', 10);
  const pageSize = Math.max(1, Math.min(settings.reading.postsPerPage, 24));

  return (
    <BlogPageView
      posts={posts}
      query={query}
      activeTag={activeTag}
      page={Number.isNaN(page) ? 1 : page}
      pageSize={pageSize}
    />
  );
}
