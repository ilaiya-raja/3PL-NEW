/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@wms/types', '@wms/zod-schemas'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
