/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for the distroless runtime image (Docker/on-prem). Vercel uses
  // its own build output, so standalone is skipped there (it also avoids the Windows EPERM symlink
  // step during local builds on Vercel-style runs).
  output: process.env.VERCEL ? undefined : 'standalone',
  // Compile the shared workspace package from source.
  transpilePackages: ['@vop/shared'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
