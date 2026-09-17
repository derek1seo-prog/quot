import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @sparticuz/chromium locates its bundled Chromium binary relative to
  // its own install path in node_modules - if Next.js bundles it into the
  // serverless function instead of leaving it as a plain runtime
  // dependency, that relative lookup breaks ("input directory .../bin
  // does not exist"). Keeping it (and puppeteer-core) external avoids
  // that, per @sparticuz/chromium's own bundler-configuration guidance.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
};

export default nextConfig;
