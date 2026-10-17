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
  experimental: {
    // A foto de perfil vai por server action e o Next limita o corpo a 1 MB por
    // omissao — menos do que os 2 MB que `enviarFotoAction` aceita e que a interface
    // anuncia. Uma fotografia entre 1 e 2 MB era recusada pelo Next antes de a action
    // correr, com um erro generico em vez da mensagem que o utilizador merece.
    //
    // 3 MB e o transporte, nao o produto: 2 MB sao o ficheiro, validados em codigo, e o
    // corpo multipart leva Boundaries e cabecalhos por cima. Com o limite colado aos
    // 2 MB, um ficheiro mesmo no maximo seria rejeitado pela envelopedura.
    serverActions: { bodySizeLimit: '3mb' },
    proxyClientMaxBodySize: '3mb',
  },
};

export default nextConfig;
