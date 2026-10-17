/** O JSON-LD de uma página, pronto a meter no `<head>` (#218).
 *
 *  Vários objectos numa página são um array (`@graph`), não vários `<script>`: o
 *  mesmo contexto num só documento, e o `mainEntity` da página aponta para o nó que
 *  a descreve em vez de haver duas cópias da mesma página. */

import { jsonLdScript } from '@/lib/structured-data';

type JsonLd = Record<string, unknown>;

export function JsonLd({ nodes }: { nodes: (JsonLd | JsonLd[])[] }) {
  // O conteúdo vem de `content.ts`, não do utilizador; a sanitização está na função
  // que o teste cobre.
  const graph = nodes.flat();
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdScript({ '@context': 'https://schema.org', '@graph': graph }) }}
    />
  );
}