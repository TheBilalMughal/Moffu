/** @type {import('next').NextConfig} */
const nextConfig = {
  // Private — not indexed; marketing site is noindex until go-live
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ],
  // Transpile workspace packages
  transpilePackages: ['@moffu/ui', '@moffu/types'],
  output: 'standalone',
};

export default nextConfig;
