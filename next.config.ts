import type { NextConfig } from 'next';

const appEnv = String(process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || 'local').trim();

const nextConfig: NextConfig = {
  env: {
    APP_ENV: appEnv,
    NEXT_PUBLIC_APP_ENV: appEnv,
  },
  reactStrictMode: false,
  productionBrowserSourceMaps: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  compress: true,
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
    serverActions: {
      bodySizeLimit: '150mb',
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
