import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.polyhaven.com",
      },
      {
        protocol: "https",
        hostname: "media.sketchfab.com",
      },
    ],
  },
};

export default nextConfig;
