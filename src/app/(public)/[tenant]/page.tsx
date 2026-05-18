import { notFound, redirect } from 'next/navigation';

import { MarketingPageRenderer } from '@/components/MarketingPageRenderer';
import { buildMetadata } from '@/features/cms/seo';
import { getPublishedPage, getSiteSettings } from '@/features/cms/publicApi';

type TenantHomePageProps = {
  params: Promise<{ tenant: string }>;
};

export async function generateMetadata() {
  const [settings, page] = await Promise.all([getSiteSettings(), getPublishedPage('home')]);
  if (!page) return { title: 'Not found' };
  return buildMetadata(settings, page.seo, page.title, page.seo.metaDescription);
}

export default async function TenantHomePage({ params }: TenantHomePageProps) {
  const { tenant } = await params;
  const [settings, homePage] = await Promise.all([getSiteSettings(), getPublishedPage('home')]);

  if (settings.reading.homepageDisplay === 'latest_posts') {
    redirect(`/${tenant}/blog`);
  }

  if (settings.reading.homepagePageId && settings.reading.homepagePageId !== 'home') {
    const targetPage = await getPublishedPage(settings.reading.homepagePageId);
    if (targetPage) {
      redirect(targetPage.seo.slug ? `/${tenant}/${targetPage.seo.slug}` : `/${tenant}`);
    }
  }

  if (!homePage) notFound();
  return <MarketingPageRenderer page={homePage} />;
}
