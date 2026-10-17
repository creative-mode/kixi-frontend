import { jsonLdScript } from '@/lib/structured-data';

type JsonLd = Record<string, unknown>;

/**
 * O JSON-LD de uma página, pronto a meter no `<head>` (#218).
 *
 * <p>Vários objectos numa página são um array (`@graph`), não vários `<script>`: é o
 * mesmo contexto num só documento, e cada nó aponta para o que descreve em vez de haver
 * duas cópias da mesma página.</p>
 *
 * <p><strong>Filhos, e não `dangerouslySetInnerHTML`.</strong> O JSON-LD é por natureza
 * conteúdo — vem de `content.ts`, e amanhã trará algo de fora. A regra de
 * auto-revisão (`xss/html-injectado`) exige que o `__html` seja um literal, e tem razão:
 * um dia um nome, um erro ou uma query entram ali e deixam de ser inofensivos. Não
 * fazendo falta a `__html`, o React escapa o conteúdo ele próprio — medido: um
 * `&lt;/script&gt;` dentro do payload sai como `&lt;/\u0073cript&gt;`, que o `JSON.parse`
 * volta a ler como a mesma frase. A sanitização em `jsonLdScript` fica como segunda
 * linha, não como a que segura isto de pé.</p>
 */
export function JsonLd({ nodes }: { nodes: (JsonLd | JsonLd[])[] }) {
  const graph = nodes.flat();
  return (
    <script type="application/ld+json">{jsonLdScript({ '@context': 'https://schema.org', '@graph': graph })}</script>
  );
}