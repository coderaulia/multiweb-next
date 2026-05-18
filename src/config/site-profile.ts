import type { PageId } from '@/features/cms/types';

export const siteProfile = {
  brand: {
    mark: '',
    wordmark: 'CMS'
  },
  navigation: {
    primaryPageOrder: ['home', 'about', 'service', 'contact'] as const satisfies readonly PageId[],
    fallbackNavigator: [
      { href: '/', label: 'Home' },
      { href: '/about', label: 'About Us' },
      { href: '/service', label: 'Services' },
      { href: '/blog', label: 'Blog' },
      { href: '/contact', label: 'Contact' }
    ],
    fallbackServices: [] as { href: string; label: string }[]
  },
  routing: {
    reservedSlugs: ['admin', 'api', 'blog', 'sitemap.xml', 'robots.txt', 'portfolio'] as const,
    serviceDetailPageIds: [
      'service-website-development',
      'service-custom-business-tools',
      'service-secure-online-shops',
      'service-mobile-business-app',
      'service-official-business-email'
    ] as const satisfies readonly PageId[]
  }
} as const;

export type ServiceDetailPageId = (typeof siteProfile.routing.serviceDetailPageIds)[number];

export function isReservedPublicSlug(slug: string) {
  return siteProfile.routing.reservedSlugs.includes(slug as (typeof siteProfile.routing.reservedSlugs)[number]);
}

export function isServiceDetailPageId(id: PageId): id is ServiceDetailPageId {
  return siteProfile.routing.serviceDetailPageIds.includes(id as ServiceDetailPageId);
}
