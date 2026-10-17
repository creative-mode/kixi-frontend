import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import test from 'node:test';
import assert from 'node:assert/strict';

// O avatar deformado (#344) nao se apanha com um teste de DOM: o `object-fit` omido
// e `fill`, que estica a imagem em vez de a escalar, e um teste que olhe para o
// `src` da fotografia nao o ve. O que se mede e o contrato do componente.
//
// Porquê um teste sobre o ficheiro e nao sobre o browser: o mock do aluno nao
// implementa `/images?kind=avatar`, o que faz `enviarFotoAction` nunca chegar a
// ter sucesso contra o mock — e sem foto carregada o `AvatarImage` do Radix nao
// monta nada. Nao ha, portanto, um avatar com imagem numa corrida de e2e.
// (A medicao real foi feita no browser, com uma 3:4 dentro de uma caixa 40x40:
// `object-fit` calculado `cover`. O que este teste garante e que a correccao
// continua la.)

const AVATAR = join(import.meta.dirname, '..', 'components', 'ui', 'avatar.tsx');
const fonte = readFileSync(AVATAR, 'utf8');

test('a imagem do avatar tem object-cover, para nao esticar a fotografia', () => {
  const imagem = /AvatarPrimitive\.Image[^>]*className=\{cn\('([^']*)'/.exec(fonte)?.[1];
  assert.ok(imagem, 'nao encontrei a className do AvatarImage');

  // A causa raiz da #344: sem isto o `object-fit` omisso e `fill`, a fotografia e
  // esticada para um quadrado e o `rounded-full` corta o resultado ja deslocado —
  // o topo da cabeca fica fora do circulo.
  assert.ok(
    imagem.split(/\s+/).includes('object-cover'),
    `o AvatarImage devia ter object-cover, tem: ${imagem}`,
  );
});

test('a raiz do avatar continua a recortar em circulo', () => {
  // O par: `overflow-hidden` + `rounded-full` e o que corta. Sem um dos dois, o
  // `object-cover` deixa de ter o que recortar.
  const raiz = /AvatarPrimitive\.Root[^>]*className=\{cn\('([^']*)'/.exec(fonte)?.[1];
  assert.ok(raiz, 'nao encontrei a className do AvatarRoot');
  for (const esperada of ['overflow-hidden', 'rounded-full']) {
    assert.ok(raiz.split(/\s+/).includes(esperada), `o AvatarRoot devia ter ${esperada}, tem: ${raiz}`);
  }
});