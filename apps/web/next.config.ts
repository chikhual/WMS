import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@maker-wms/shared'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
