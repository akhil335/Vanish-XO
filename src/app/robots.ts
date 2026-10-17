import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/config';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/room/*',
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
