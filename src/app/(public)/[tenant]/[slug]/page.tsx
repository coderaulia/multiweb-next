import { draftMode } from 'next/headers';
import { notFound } from 'next/navigation';

import { MarketingPageRenderer } from '@/components/MarketingPageRenderer';
import { PreviewModeBanner } from '@/components/PreviewModeBanner';
import { isReservedPublicSlug } from '@/config/site-profile';
import { buildMetadata } from '@/features/cms/seo';
import {
  getPreviewPageBySlug,
  getPublishedPageBySlug,
  getPublishedPages,
  getSiteSettings
} from '@/features/cms/publicApi';

type TenantDynamicPageProps = {
  params: Promise<{ tenant: string; slug: string }>;
};

export async function generateStaticParams() {
  const pages = await getPublishedPages();
  return pages
    .filter((page) => page.seo.slug.trim().length > 0 && !isReservedPublicSlug(page.seo.slug))
    .map((page) => ({ slug: page.seo.slug }));
}

export async function generateMetadata({ params }: TenantDynamicPageProps) {
  const { slug } = await params;
  if (isReservedPublicSlug(slug)) return {};
  const isPreview = (await draftMode()).isEnabled;
  const [settings, page] = await Promise.all([
    getSiteSettings(),
    isPreview ? getPreviewPageBySlug(slug) : getPublishedPageBySlug(slug)
  ]);
  if (!page) return {};
  return buildMetadata(settings, page.seo, page.title, page.seo.metaDescription);
}

export default async function TenantDynamicPage({ params }: TenantDynamicPageProps) {
  const { tenant, slug } = await params;
  if (isReservedPublicSlug(slug)) notFound();
  const isPreview = (await draftMode()).isEnabled;
  const page = await (isPreview ? getPreviewPageBySlug(slug) : getPublishedPageBySlug(slug));
  if (!page) notFound();

  const previewBanner = isPreview ? <PreviewModeBanner path={`/${tenant}/${slug}`} /> : null;

  return (
    <>
      {previewBanner}
      <MarketingPageRenderer page={page} />
    </>
  );
}
