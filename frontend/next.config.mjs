/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: false,
  },
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE;
    if (!apiBase) return [];
    return [
      {
        source: '/proxy/:path*',
        destination: `${apiBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
