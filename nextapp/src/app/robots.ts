import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/dashboard',
        '/login',
        '/webmail',
        '/webmail-login',
        '/checkout/',
      ],
    },
    sitemap: 'https://www.altegic.co.za/sitemap.xml',
  };
}
