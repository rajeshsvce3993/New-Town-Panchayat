import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: false,
  productionBrowserSourceMaps: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  webpack: (config, { isServer, webpack }) => {
    if (isServer) {
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^@valkey\/valkey-glide$/,
        })
      );
    }
    return config;
  },
};

export default nextConfig;
