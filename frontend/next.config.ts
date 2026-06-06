import type { NextConfig } from "next";

// Enable static export only at build time. In dev (next dev) we use the
// regular Next.js server so dynamic routes work without pre-rendering.
const isProductionBuild = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  ...(isProductionBuild && { output: "export" as const }),
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
