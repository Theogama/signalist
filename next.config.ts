import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable source maps in development to avoid source map parsing errors
  productionBrowserSourceMaps: false,
  // Configure webpack to handle source maps better
  webpack: (config, { dev, isServer }) => {
    // Disable source maps in development to prevent parsing errors
    if (dev) {
      config.devtool = false;
    }
    return config;
  },
};

export default nextConfig;
