#!/usr/bin/env node
/**
 * Gera os ícones das três páginas a partir de uma única fonte: `public/icon/`.
 *
 * Os três apps vivem no mesmo endereço (`/`, `/aluno`, `/manager`), e cada browser pede
 * o ícone à raiz e ao endereço da app. Sem isto, a landing não tinha nenhum, o gestor
 * tinha um que não era o da marca e o aluno não tinha nada (issue #404).
 *
 * Nada se desenha aqui: o ficheiro em `public/icon/` é a fonte, e este script só o
 * distribui e deriva o `apple-icon` que o iOS exige a 180×180. Para desenhar outro
 * marca, muda-se o ficheiro fonte e corre-se o script.
 *
 *   node scripts/icons.mjs           escreve os ficheiros
 *   node scripts/icons.mjs --check   falha se algum não bater certo (para a CI)
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONTE = join(RAIZ, 'public', 'icon');

/** Onde está cada app e o que é que ele serve. O `manifest` só existe onde a app o
 *  referencia: o gestor tem-no ligado em `app/layout.tsx`, e o aluno e a landing não têm
 *  service worker (está comentado, e o `sw.js` desregista-se) — anunciar instalabilidade
 *  sem isso seria uma promessa que a app não cumpre. */
const APPS = [
  { dir: '.', nome: 'Kixi Manager', atalhoRaiz: '/manager', manifest: true },
  { dir: 'student', nome: 'Kixi', atalhoRaiz: '/aluno', manifest: false },
  { dir: 'landing', nome: 'Kixi', atalhoRaiz: '', manifest: false },
];

/** O iOS não aceita o ícone em SVG: `apple-icon` tem de ser um PNG de 180×180. */
const APPLE = 180;

async function ficheiro(destino, conteudo) {
  if (!existsSync(dirname(destino))) await mkdir(dirname(destino), { recursive: true });
  const bytes = Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo);
  try {
    if (Buffer.compare(await readFile(destino), bytes) === 0) return false;
  } catch {
    // Não existia: escreve-se.
  }
  await writeFile(destino, bytes);
  return true;
}

async function main() {
  const check = process.argv.includes('--check');
  const svg = await readFile(join(FONTE, 'icon1.svg'));
  const ico = await readFile(join(FONTE, 'favicon.ico'));
  const png512 = await readFile(join(FONTE, 'icon-512x512.png'));
  const png192 = await readFile(join(FONTE, 'icon-192x192.png'));
  const apple = await sharp(png512).resize(APPLE, APPLE, { fit: 'contain' }).png().toBuffer();

  const mudados = [];
  const conferidos = [];

  for (const app of APPS) {
    const base = join(RAIZ, app.dir);

    // Convenção do Next: `app/icon.svg`, `app/favicon.ico` e `app/apple-icon.png` geram
    // os `<link>` sozinhos, sem mexer no metadata de cada layout.
    const alvos = [
      [join(base, 'app', 'icon.svg'), svg],
      [join(base, 'app', 'favicon.ico'), ico],
      [join(base, 'app', 'apple-icon.png'), apple],
      // Os PNG para o manifest, em `public/` porque o Next não os serve de `app/`.
      [join(base, 'public', 'icon', 'icon-192x192.png'), png192],
      [join(base, 'public', 'icon', 'icon-512x512.png'), png512],
    ];

    if (app.manifest) {
      const raiz = app.atalhoRaiz;
      alvos.push([
        join(base, 'public', 'manifest.json'),
        `${JSON.stringify(
          {
            name: app.nome,
            short_name: app.nome,
            description: 'Painel de gestão do Kixi',
            start_url: `${raiz}/`,
            scope: `${raiz}/`,
            display: 'standalone',
            background_color: '#ffffff',
            theme_color: '#f6f8f5',
            lang: 'pt-PT',
            icons: [
              { src: `${raiz}/icon/icon-192x192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
              { src: `${raiz}/icon/icon-512x512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
            ],
          },
          null,
          4,
        )}\n`,
      ]);
    }

    for (const [destino, conteudo] of alvos) {
      if (check) {
        const atual = existsSync(destino) ? await readFile(destino) : null;
        const igual = atual !== null && Buffer.compare(atual, Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo)) === 0;
        (igual ? conferidos : mudados).push(destino.replace(`${RAIZ}/`, ''));
      } else {
        if (await ficheiro(destino, conteudo)) mudados.push(destino.replace(`${RAIZ}/`, ''));
      }
    }
  }

  if (check) {
    if (mudados.length > 0) {
      console.error('Estes ficheiros não estão a bater certo com public/icon/:');
      for (const f of mudados) console.error(`  ${f}`);
      console.error('\nCorre `node scripts/icons.mjs` e commita o resultado.');
      process.exit(1);
    }
    console.log(`Ícones: ${conferidos.length} ficheiros conferidos, todos iguais à fonte.`);
    return;
  }

  console.log(mudados.length === 0 ? 'Nada a mudar: os ícones já estavam certos.' : `${mudados.length} ficheiro(s) escritos:`);
  for (const f of mudados) console.log(`  ${f}`);
}

// A assinatura do ficheiro, para o erro dizer qual é a fonte e não só que há um.
process.on('unhandledRejection', async (erro) => {
  const sha = createHash('sha256').update(await readFile(join(FONTE, 'icon1.svg'))).digest('hex').slice(0, 12);
  console.error(`icons.mjs falhou (fonte public/icon/icon1.svg, sha256:${sha}):`, erro);
  process.exit(1);
});

await main();