import type { NextConfig } from "next";

const apiBaseUrl = process.env.FASTAPI_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: "standalone",

  // Allow next/image to work with remote images
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // Proxy API calls to FastAPI backend
  async rewrites() {
    return [
      {
        source: "/fastapi/:path*",
        destination: apiBaseUrl + "/:path*",
      },
    ];
  },
};

export default nextConfig;