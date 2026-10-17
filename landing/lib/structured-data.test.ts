// node --test lib/structured-data.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { FAQ, MODULES } from './content.ts';
import { faqPageLd, jsonLdScript, organizationLd, serviceLd, webPageLd, webSiteLd } from './structured-data.ts';

/** Os dados estruturados (#218). Duas coisas interessam aqui: que o JSON-LD diga o
 *  que a página diz, e que o que vai para dentro do `<script>` não o consiga fechar. */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

test('a organização e o sítio apontam um para o outro, e sem contactos inventados', () => {
  const org = organizationLd();
  const site = webSiteLd();
  assert.equal(org['@type'], 'Organization');
  assert.equal(site['@type'], 'WebSite');
  assert.equal((site.publisher as { '@id': string })['@id'], org['@id']);
  // Sem NEXT_PUBLIC_CONTACT_EMAIL não há contacto no JSON-LD: um endereço que
  // ninguém escreveu não é contacto, é invenção.
  assert.equal(org.contactPoint, undefined);
});

test('o Website não declara um SearchAction que não existe', () => {
  // A landing não tem pesquisa pública. Declarar a acção seria dizer aos motores
  // que há um campo de pesquisa que leadaria a lado nenhum.
  assert.equal(webSiteLd().potentialAction, undefined);
});

test('as perguntas do FAQPage são as mesmas que a página mostra, palavra por palavra', () => {
  const main = (faqPageLd().mainEntity ?? []) as { name: string; acceptedAnswer: { text: string } }[];
  assert.equal(main.length, FAQ.length);
  assert.deepEqual(main.map((q) => q.name), FAQ.map((f) => f.q));
  assert.deepEqual(main.map((q) => q.acceptedAnswer.text), FAQ.map((f) => f.a));
});

test('os módulos aparecem todos, com número e texto', () => {
  const catalog = (serviceLd().hasOfferCatalog as { itemListElement: { position: number; item: { name: string; description: string } }[] }).itemListElement;
  assert.equal(catalog.length, MODULES.length);
  assert.equal(catalog[0].position, 1);
  MODULES.forEach((m, i) => assert.ok(catalog[i].item.name.includes(m.title), m.title));
  MODULES.forEach((m, i) => assert.equal(catalog[i].item.description, m.text));
});

test('um `</script>` no conteúdo não fecha o bloco do JSON-LD', () => {
  // A sanitização vive no componente JsonLd, e é o único sítio onde o texto entra
  // no HTML. Um `<` isolado basta para fechar a tag.
  const payload = jsonLdScript({ a: '</script><img>' });
  assert.ok(!payload.includes('</script>'));
  assert.ok(!payload.includes('<img>'));
  assert.ok(payload.includes('\\u003c/script>'));
});

test('a página sabe o que é e de que site faz parte', () => {
  const page = webPageLd('Doa um enunciado · Kixi', '/doar', 'Doa uma prova.');
  assert.equal(page['@type'], 'WebPage');
  assert.ok(String(page.url).endsWith('/doar'));
  assert.ok(isObject(page.isPartOf) && String((page.isPartOf as { '@id': string })['@id']).endsWith('#site'));
});