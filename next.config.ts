import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ESLint is now configured via eslint.config.js or .eslintrc
  // Remove eslint config from here for Next.js 16+
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable source maps in production to avoid source map parsing errors
  productionBrowserSourceMaps: false,
  // Turbopack configuration (Next.js 16+ uses Turbopack by default)
  turbopack: {
    // Empty config to silence the warning
    // Turbopack handles source maps automatically
  },
};

export default nextConfig;
