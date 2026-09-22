/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Applies to every route. CSP specifically is the one header
        // here that carries real risk of breaking something (an
        // overly strict policy can silently block a legitimate script,
        // font, or style) — deliberately kept permissive enough to
        // allow Next.js's own inline hydration scripts and Google
        // Fonts (both already used across this app) rather than risk
        // breaking the live site with no way to visually verify it
        // from this environment. The other headers below carry no
        // such risk.
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self'",
              "frame-ancestors 'self'",
            ].join('; '),
          },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
