import type { NextConfig } from "next";

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
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: 'https://techify.ao',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
