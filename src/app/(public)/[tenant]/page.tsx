import { notFound, redirect } from 'next/navigation';

import { MarketingPageRenderer } from '@/components/MarketingPageRenderer';
import { resolveTenantBySlug } from '@/features/cms/tenantContext';
import { buildMetadata } from '@/features/cms/seo';
import { getPublishedPage, getSiteSettings } from '@/features/cms/publicApi';
import type { PageId } from '@/features/cms/types';

type TenantHomePageProps = {
  params: Promise<{ tenant: string }>;
};

export async function generateMetadata({ params }: TenantHomePageProps) {
  const { tenant: tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  const tenantId = tenant?.id;
  const [settings, page] = await Promise.all([getSiteSettings(tenantId), getPublishedPage('home', tenantId)]);
  if (!page) return { title: 'Not found' };
  return buildMetadata(settings, page.seo, page.title, page.seo.metaDescription);
}

export default async function TenantHomePage({ params }: TenantHomePageProps) {
  const { tenant: tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  const tenantId = tenant?.id;
  const [settings, homePage] = await Promise.all([getSiteSettings(tenantId), getPublishedPage('home', tenantId)]);

  if (settings.reading.homepageDisplay === 'latest_posts') {
    redirect(`/${tenantSlug}/blog`);
  }

  if (settings.reading.homepagePageId && settings.reading.homepagePageId !== 'home') {
    const targetPage = await getPublishedPage(settings.reading.homepagePageId as PageId, tenantId);
    if (targetPage) {
      redirect(targetPage.seo.slug ? `/${tenantSlug}/${targetPage.seo.slug}` : `/${tenantSlug}`);
    }
  }

  if (!homePage) notFound();
  return <MarketingPageRenderer page={homePage} />;
}
