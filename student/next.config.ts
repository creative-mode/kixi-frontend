import path from 'node:path';
import type { NextConfig } from 'next';

// This app lives inside the kixi-frontend repo next to the manager app: pin the root so
// Next does not pick up the parent's postcss config, proxy.ts or lockfile.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Um só endereço: o gateway (npm run dev:all) serve este app em /aluno.
  basePath: '/aluno',
  turbopack: { root: path.resolve(__dirname) },
  // Imagem Docker mínima (docker/app.Dockerfile); a raiz fixa evita que o servidor fique em subpastas.
  output: 'standalone',
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;
