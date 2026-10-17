/** Os dados estruturados da landing (#218), tirados do que o `content.ts` já diz.
 *
 *  Nenhum texto novo: o que um motor de busca ou um agente de IA leia aqui é o mesmo
 *  que está no ecrã. Se amanhã o conceito mudar, muda em `content.ts` e o JSON-LD
 *  segue — escrever as duas coisas em separado é como os dois passam a divergir. */

// A extensão é explícita porque os testes correm no node (node --test), que não
// resolve um import sem extensão.
import {
  AUDIENCES,
  CONTACT_EMAIL,
  CONTACT_PHONE,
  CONTACT_POSTAL_ADDRESS,
  FAQ,
  MODULES,
  SITE_URL,
} from './content.ts';

/**
 * Um nó do grafo, sem `@context`.
 *
 * <p>O `@context` põe-o o `JsonLd`, uma vez, à volta do `@graph`: repetido em cada nó
 * é ruído que um validador tem de ignorar e que ninguém lê.</p> */
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

/**
 * A organização, com o contacto que a publicação consegue declarar.
 *
 * <p>Cada campo entra só quando o build o define. Metade contacto é pior do que
 * nenhum: um `Organization` com `email` e sem `address` parece verificado quando não
 * está, e é o que um agente usa para responder a "quem é esta empresa".</p>
 */
export function organizationLd(): JsonLd {
  return organizationLdFrom({ email: CONTACT_EMAIL, phone: CONTACT_PHONE, address: CONTACT_POSTAL_ADDRESS });
}

/** O mesmo, com o contacto à mão: o que entra na publicação vem do build, e esta
 *  função é onde se decide se um campo entra ou fica de fora. */
export function organizationLdFrom(contact: {
  email?: string;
  phone?: string;
  address: { street: string; locality: string; postalCode: string; addressCountry: string };
}): JsonLd {
  const { email, phone } = contact;
  const { street, locality, postalCode, addressCountry } = contact.address;
  const hasAddress = Boolean(street && locality);

  // Os campos vêm do que foi passado, não das constantes do módulo: quem chama passa o
  // que a publicação declarou, e é esta função que decide o que entra.
  const contactPoint = email
    ? [
        {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          ...(phone ? { telephone: phone } : {}),
          email,
          ...(hasAddress
            ? {
                address: {
                  '@type': 'PostalAddress',
                  ...(street ? { streetAddress: street } : {}),
                  addressLocality: locality,
                  ...(postalCode ? { postalCode } : {}),
                  addressCountry,
                },
              }
            : {}),
        },
      ]
    : undefined;

  return {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organizacao`,
    name: 'Kixi',
    url: `${SITE_URL}/`,
    ...(hasAddress ? { address: { '@type': 'PostalAddress', streetAddress: street, addressLocality: locality, ...(postalCode ? { postalCode } : {}), addressCountry } } : {}),
    ...(contactPoint ? { contactPoint } : {}),
  };
}

/** O sítio, e o que se pode perguntar-lhe. Sem `SearchAction`: não há pesquisa
 *  pública na landing, e declarar uma acção de pesquisa que não existe é pior do que
 *  não declarar nenhuma. */
export function webSiteLd(): JsonLd {
  return {
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