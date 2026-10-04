import path from 'node:path';
import type { NextConfig } from 'next';

// Lives next to the manager app in the same repo: pin the root so Next ignores the parent's
// postcss config, proxy.ts and lockfile.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
