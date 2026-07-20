/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@wms/types", "@wms/zod-schemas"],
};

module.exports = nextConfig;
