import { PortfolioPageView } from '@/components/pages/PortfolioPageView';
import { buildMetadata } from '@/features/cms/seo';
import { getPublishedPortfolioProjects, getSiteSettings } from '@/features/cms/publicApi';
import { resolveTenantBySlug } from '@/features/cms/tenantContext';

type PortfolioListPageProps = {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{
    q?: string;
    tag?: string;
    page?: string;
  }>;
};

export async function generateMetadata({ params }: PortfolioListPageProps) {
  const { tenant: tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  const settings = await getSiteSettings(tenant?.id);
  return buildMetadata(
    settings,
    {
      metaTitle: 'Portfolio | Case Studies, Web Development, and Digital Infrastructure Results',
      metaDescription: 'Explore portfolio case studies across websites, automation systems, ecommerce, and mobile solutions.',
      slug: 'portfolio',
      canonical: '',
      socialImage: settings.defaultOgImage,
      noIndex: false,
      keywords: ['portfolio case study', 'web development portfolio', 'digital agency projects']
    },
    'Portfolio | Case Studies, Web Development, and Digital Infrastructure Results',
    'Explore portfolio case studies across websites, automation systems, ecommerce, and mobile solutions.'
  );
}

export default async function TenantPortfolioListPage({ params: paramsPromise, searchParams }: PortfolioListPageProps) {
  const { tenant: tenantSlug } = await paramsPromise;
  const tenant = await resolveTenantBySlug(tenantSlug);
  const [params, settings, projects] = await Promise.all([
    searchParams,
    getSiteSettings(tenant?.id),
    getPublishedPortfolioProjects(tenant?.id)
  ]);

  const query = params.q ?? '';
  const activeTag = params.tag ?? 'all';
  const page = Number.parseInt(params.page ?? '1', 10);
  const pageSize = Math.max(1, Math.min(settings.reading.postsPerPage, 24));

  return (
    <PortfolioPageView
      projects={projects}
      query={query}
      activeTag={activeTag}
      page={Number.isNaN(page) ? 1 : page}
      pageSize={pageSize}
    />
  );
}
