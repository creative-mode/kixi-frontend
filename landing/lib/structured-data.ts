/** Os dados estruturados da landing (#218), tirados do que o `content.ts` já diz.
 *
 *  Nenhum texto novo: o que um motor de busca ou um agente de IA leia aqui é o mesmo
 *  que está no ecrã. Se amanhã o conceito mudar, muda em `content.ts` e o JSON-LD
 *  segue — escrever as duas coisas em separado é como os dois passam a divergir. */

// A extensão é explícita porque os testes correm no node (node --test), que não
// resolve um import sem extensão.
import { AUDIENCES, CONTACT_EMAIL, FAQ, MODULES, SITE_URL } from './content.ts';

const CONTEXT = 'https://schema.org';

type JsonLd = Record<string, unknown>;

/**
 * O JSON-LD vai para dentro de um `<script>` e `JSON.stringify` não sanitiza: um
 * `</script>` numa das perguntas fechava o bloco antes do fim da página. A
 * documentação do Next pede exactamente isto.
 *
 * Vive aqui e não no componente para o teste cobrir a função que corre, não uma
 * cópia dela escrita à mão ao lado da asserção.
 */
export function jsonLdScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** A organização. Sem `logo` e sem contactos inventados: `CONTACT_EMAIL` só entra
 *  quando o build o define, porque um endereço que ninguém escreveu não é contacto. */
export function organizationLd(): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organizacao`,
    name: 'Kixi',
    url: `${SITE_URL}/`,
    ...(CONTACT_EMAIL ? { contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', email: CONTACT_EMAIL }] } : {}),
  };
}

/** O sítio, e o que se pode perguntar-lhe. Sem `SearchAction`: não há pesquisa
 *  pública na landing, e declarar uma acção de pesquisa que não existe é pior do que
 *  não declarar nenhuma. */
export function webSiteLd(): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#site`,
    name: 'Kixi',
    url: `${SITE_URL}/`,
    description: 'Provas simuladas, um tutor de IA que conhece cada questão e uma rede de estudo entre escolas.',
    inLanguage: 'pt-AO',
    publisher: { '@id': `${SITE_URL}/#organizacao` },
  };
}

/** A página, para que um agente saiba o que está a ler e qual a sua secção. */
export function webPageLd(name: string, path: string, description: string): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'WebPage',
    '@id': `${SITE_URL}${path}#pagina`,
    name,
    description,
    url: `${SITE_URL}${path}`,
    inLanguage: 'pt-AO',
    isPartOf: { '@id': `${SITE_URL}/#site` },
  };
}

/** As perguntas que a página responde, com o texto tal e qual como está no ecrã.
 *
 *  A regra do Google é que as perguntas e respostas venham do conteúdo visível: um
 *  FAQPage com perguntas que a página não mostra não é enriquecimento, é propaganda
 *  com `application/ld+json` em vez de HTML. Por isso isto lê `FAQ` e nada mais. */
export function faqPageLd(): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'FAQPage',
    '@id': `${SITE_URL}/#perguntas`,
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/** Os cinco módulos, como lista de funcionalidades do serviço.
 *
 *  `Service` e não `Product`: o Kixi é uma plataforma de avaliação usada por escolas,
 *  não um pacote à venda, e o cabeçalho do módulo já diz o que cada um faz. */
export function serviceLd(): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'Service',
    '@id': `${SITE_URL}/#servico`,
    name: 'Kixi',
    serviceType: 'Plataforma de avaliação e estudo',
    description: MODULES.map((m) => `${m.title}: ${m.headline}`).join(' '),
    provider: { '@id': `${SITE_URL}/#organizacao` },
    areaServed: 'AO',
    audience: AUDIENCES.map((a) => ({ '@type': 'Audience', name: a.title, description: a.line })),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Módulos do Kixi',
      itemListElement: MODULES.map((m, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: { '@type': 'Service', name: `${m.n}. ${m.title}`, description: m.text },
      })),
    },
  };
}