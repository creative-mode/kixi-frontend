import path from 'node:path';
import type { NextConfig } from 'next';

// Lives next to the manager app in the same repo: pin the root so Next ignores the parent's
// postcss config, proxy.ts and lockfile.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: path.resolve(__dirname) },
  // Se a landing for aberta direto em :3004 (sem o gateway em :3000), /aluno e /manager vão para os outros apps.
  async rewrites() {
    if (process.env.NODE_ENV === 'production') return [];
    const student = process.env.STUDENT_PORT ?? 3003;
    const manager = process.env.MANAGER_PORT ?? 3002;
    return [
      { source: '/aluno/:path*', destination: `http://localhost:${student}/aluno/:path*` },
      { source: '/manager/:path*', destination: `http://localhost:${manager}/manager/:path*` },
    ];
  },
};

export default nextConfig;
