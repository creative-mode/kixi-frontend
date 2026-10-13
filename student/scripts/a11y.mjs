// Auditoria de acessibilidade sem browser:  node student/scripts/a11y.mjs
//
// Existe porque o critério de aceitação da FE-25 é «Lighthouse Acessibilidade >= 90»,
// e o `flow.mjs` nao olha para nada disso. Medir a nota a olho nao e medicao, e um
// numero so medido uma vez nao sobrevive a alguem mexer num token.
//
// Isto **nao** substitui o Lighthouse, e o script diz isso ao falhar. O que faz e
// guardar as tres coisas que quebram em silencio e que o Lighthouse so apanha se
// alguem o correr:
//
//   1. contraste dos pares de token de texto (WCAG 1.4.3, AA = 4.5:1), nos dois temas
//   2. alvos de toque do botao por baixo de 44 px no ecra pequeno (WCAG 2.5.5)
//   3. o bloco `prefers-reduced-motion` e a excepcao dos spinners, no aluno
//
// Corre com `npm run test:a11y` no directorio `student/`. Sai != 0 se algo falhar.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const STUDENT = join(AQUI, '..');
const RAIZ = join(STUDENT, '..');

let problemas = 0;
const falhar = (msg) => {
  problemas++;
  console.log(`  FALHA  ${msg}`);
};
const ok = (msg) => console.log(`  ok     ${msg}`);

const ler = (...partes) => readFileSync(join(...partes), 'utf8');

// ---------------------------------------------------------------- contraste
// Razao WCAG. Os canais entram como sRGB e saem lineares pela curva da propria
// especificacao, antes da luminancia relativa.
const srgb = (hex) => {
  const limpo = hex.trim().replace('#', '');
  return [0, 2, 4].map((i) => parseInt(limpo.slice(i, i + 2), 16));
};
const linear = (canal) => {
  const c = canal / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const luminancia = (hex) => {
  const [r, g, b] = srgb(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const razao = (a, b) => {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

function blocoDeTokens(css, seletor) {
  const comeco = css.indexOf(seletor);
  if (comeco === -1) throw new Error(`tokens.css nao tem o bloco ${seletor}`);
  const ate = css.indexOf('}', comeco);
  const bloco = css.slice(comeco, ate);
  const tokens = {};
  for (const [, nome, valor] of bloco.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    tokens[nome] = valor;
  }
  return tokens;
}

function medirContraste() {
  console.log('\nContraste dos pares de texto (WCAG 1.4.3, AA = 4.5:1)');
  const css = ler(RAIZ, 'design-system', 'tokens.css');
  const temas = [
    ['claro', blocoDeTokens(css, ':root,[data-theme=\'light\']')],
    ['escuro', blocoDeTokens(css, '.dark,[data-theme=\'dark\']')],
  ];

  // Pares de texto: (primeiro plano, fundo, nome). `border` fica de fora de proposito
  // - a WCAG 1.4.11 exige-lhe 3:1 so quando a borda e o unico sinal do controlo, e
  // medir o token a esvaziada nao responde a essa pergunta.
  const pares = [
    ['foreground', 'background'],
    ['foreground', 'card'],
    ['muted-foreground', 'background'],
    ['muted-foreground', 'card'],
    ['primary-foreground', 'primary'],
    ['secondary-foreground', 'secondary'],
    ['accent-foreground', 'accent'],
    ['destructive-foreground', 'destructive'],
    ['primary', 'background'],
    ['destructive', 'background'],
  ];

  let medidos = 0;
  for (const [nomeTema, tokens] of temas) {
    for (const [frente, fundo] of pares) {
      const a = tokens[frente];
      const b = tokens[fundo];
      if (!a || !b) continue; // o tema escuro nao repete todos os tokens
      medidos++;
      const r = razao(a, b);
      if (r < 4.5) {
        falhar(`${nomeTema}: ${frente} sobre ${fundo} = ${r.toFixed(2)}:1 (min 4.5:1)`);
      }
    }
  }
  ok(`${medidos} pares medidos nos dois temas`);
}

// ------------------------------------------------------------- alvos de toque
// As classes saem do `button.tsx` de cada copia do design system. Procura o
// tamanho base de cada variante e so falha se ele for menor que 44 px sem um
// `md:` que o volte a levantar - que e o que o plano decidiu para nao partir as
// tabelas do gestor.
function medirAlvos() {
  console.log('\nAlvos de toque do botao (WCAG 2.5.5, 44 px no ecra pequeno)');
  const copias = [
    ['aluno', join(STUDENT, 'components', 'ui', 'button.tsx')],
    ['gestor', join(RAIZ, 'components', 'ui', 'button.tsx')],
  ];

  for (const [nome, caminho] of copias) {
    const fonte = ler(caminho);
    const variantes = [...fonte.matchAll(/^\s*'?([a-z-]+)'?:\s*'([^']*(?:h-\d+|size-\d+)[^']*)'/gm)];
    if (variantes.length === 0) falhar(`${nome}: nao encontrei variantes de tamanho em ${caminho}`);

    for (const [, variante, classes] of variantes) {
      const base = classes.match(/(?:^|\s)(h-\d+|size-\d+)(?=\s|$)/);
      if (!base) continue;

      const px = Number(base[1].replace(/\D/g, '')) * 4; // h-9 = 2.25rem
      const temDesktop = /md:(?:h|size)-/.test(classes);
      const desktop = classes.match(/md:(?:h|size)-(\d+)/);

      if (temDesktop && desktop) {
        const pxDesktop = Number(desktop[1]) * 4;
        if (px < 44 && pxDesktop < 44) {
          falhar(`${nome}/${variante}: ${px} px no ecra pequeno e ${pxDesktop} px no desktop`);
        } else {
          ok(`${nome}/${variante}: ${px} px no ecra pequeno`);
        }
      } else if (px < 44) {
        falhar(`${nome}/${variante}: ${px} px em todo o ecra, sem variante de telemovel`);
      } else {
        ok(`${nome}/${variante}: ${px} px`);
      }
    }
  }
}

// ------------------------------------------------------- prefers-reduced-motion
function medirMovimento() {
  console.log('\nprefers-reduced-motion');
  const globals = ler(STUDENT, 'app', 'globals.css');
  // Procura-se a at-rule, nao a palavra: o bloco tem um comentario em cima que
  // a menciona, e um `includes` pela palavra passava com o bloco apagado.
  if (!/@media[^{]*prefers-reduced-motion\s*:\s*reduce/.test(globals)) {
    falhar('o aluno nao tem bloco prefers-reduced-motion em app/globals.css');
  } else if (!/\.animate-spin/.test(globals)) {
    falhar('o aluno nao isenta os spinners de carga do redutor de movimento');
  } else {
    ok('o aluno reduz movimento e mantem os spinners');
  }

  // O bloco global do gestor nao apanha o framer-motion, que anima em JS. A
  // unica defesa e o `MotionConfig reducedMotion="user"`, e nao ha teste que
  // garanta que ninguem o remove ao trocar o navbar.
  const navbar = ler(RAIZ, 'components', 'manager-navbar.tsx');
  if (!/from ["']framer-motion["']/.test(navbar)) {
    ok('o navbar do gestor ja nao usa framer-motion');
  } else if (!/reducedMotion=["']user["']/.test(navbar)) {
    falhar('o navbar usa framer-motion sem MotionConfig reducedMotion="user"');
  } else {
    ok('o navbar do gestor respeita reducedMotion="user"');
  }
}

// ------------------------------------------------------ skip-link e landmarks
function medirTeclado() {
  console.log('\nSkip-link e landmark de conteudo');
  const casos = [
    ['aluno', join(STUDENT, 'components', 'Shell.tsx'), /href="#conteudo"/],
    ['aluno', join(STUDENT, 'components', 'Shell.tsx'), /<main[^>]*id="conteudo"/],
    ['aluno', join(STUDENT, 'components', 'Shell.tsx'), /<main[^>]*tabIndex=\{-1\}/],
    ['gestor', join(RAIZ, 'components', 'auth-layout.tsx'), /href="#conteudo"/],
    ['gestor', join(RAIZ, 'components', 'auth-layout.tsx'), /<main[^>]*id="conteudo"/],
    ['landing', join(RAIZ, 'landing', 'app', 'page.tsx'), /<main[^>]*id="conteudo"/],
  ];

  for (const [nome, caminho, re] of casos) {
    const alvo = caminho.split('/').slice(-1)[0];
    if (!re.test(ler(caminho))) {
      falhar(`${nome}/${alvo}: falta ${re} — o teclado nao chega ao conteudo`);
    } else {
      ok(`${nome}/${alvo}`);
    }
  }
}

console.log('Auditoria de acessibilidade (FE-25)');
medirContraste();
medirAlvos();
medirMovimento();
medirTeclado();

console.log('');
if (problemas > 0) {
  console.log(`${problemas} problema(s). Nenhum e estilo: cada um ja custou um bug.`);
  console.log('');
  console.log('Isto NAO e o Lighthouse. O criterio da issue e a nota >= 90, que exige');
  console.log('o binario e um Chrome; este script so guarda o que quebra em silencio.');
  process.exit(1);
}
console.log('Tudo dentro do esperado.');