import type { NextConfig } from "next";
import { cabecalhosDeSeguranca } from './lib/security-headers';

const nextConfig: NextConfig = {
  /* config options here */
  enablePrerenderSourceMaps: false,
  productionBrowserSourceMaps: false,
  // Igual a BASE_PATH em lib/constants.ts, que os pedidos feitos à mão usam.
  basePath: '/manager',
  // Imagem Docker mínima (docker/app.Dockerfile)
  output: 'standalone',
  experimental: {
    // O upload OCR vai por server action: o limite por omissão (1 MB) recusava uma
    // fotografia de telemóvel. 50 MB é o total que o backend aceita (lib/crud/ocr-files.ts).
    serverActions: { bodySizeLimit: '50mb' },
    // O proxy.ts guarda o corpo em memória até 10 MB e corta o resto; tem de deixar passar o mesmo.
    proxyClientMaxBodySize: '50mb',
  },

  async redirects() {
    return [
      {
        source: '/',
        destination: '/manager',
        basePath: false,
        permanent: false,
      },
    ];
  },

  async rewrites() {
    return [];
  },
  async headers() {
    return [{ source: '/:path*', headers: cabecalhosDeSeguranca() }];
  },
};

export default nextConfig;
