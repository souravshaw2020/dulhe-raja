import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  experimental: {
    agentUpgrade: "security",
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
