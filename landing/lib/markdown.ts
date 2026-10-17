/**
 * A landing em Markdown, e o `llms.txt` (#218).
 *
 * Tudo o que sai daqui é o `content.ts` reescrito em texto: nada é inventado, e
 * uma pergunta que responde aqui responde também no ecrã. Um agente que lê isto
 * fica a saber a mesma coisa que um humano lê ao abrir a página.
 */

import { AUDIENCES, CONTACT_EMAIL, FAQ, MODULES, SIGNUP_URL, SITE_URL } from './content.ts';

/** O `Contact` de um documento Markdown. Sem ele o bloco de YAML não liga a nada. */
type FrontMatter = Record<string, string>;

/** Linhas de YAML simples: strings com aspas, listas com `-`. */
function yaml(fields: FrontMatter): string {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return ['---', ...lines, '---'].join('\n');
}

function heading(text: string, level = 2): string {
  return `${'#'.repeat(level)} ${text}`;
}

/** A home: o que o Kixi é, o que faz, para quem, e como entrar. */
export function homeMarkdown(): string {
  const parts: string[] = [
    yaml({
      title: 'Kixi',
      description:
        'Provas simuladas, um tutor de IA que conhece cada questão e uma rede de estudo entre escolas.',
      url: `${SITE_URL}/`,
      lang: 'pt-AO',
    }),
    '',
    '# Kixi',
    '',
    'E se estudar fosse... divertido?',
    '',
    'O Kixi transforma cada prova num gémeo digital: fotografas a prova, fazes uma simulação',
    'com os parâmetros que o teu professor definiu, comparas como outras escolas resolveram e',
    'perguntas ao tutor o que não percebes. Feito por alunos do ITEL, para alunos.',
    '',
    heading('O que podes fazer'),
    '',
    ...MODULES.flatMap((m) => [
      `- **${m.n}. ${m.title}** — ${m.headline} ${m.text}`,
    ]),
    '',
    heading('Para quem'),
    '',
    ...AUDIENCES.map((a) => [`- **${a.title}** — ${a.line}`, ...a.items.map((i) => `  - ${i}`)]).flat(),
    '',
    heading('Começar'),
    '',
    `- Criar conta e entrar: ${SIGNUP_URL}`,
  ];
  return parts.join('\n');
}

/** A página de doação de enunciados. */
export function donateMarkdown(): string {
  return [
    yaml({
      title: 'Doa um enunciado · Kixi',
      description:
        'Tens uma prova, um teste ou um exame antigo? Doa-o ao Kixi: uma foto ou um PDF chega para ajudar outros alunos a estudar.',
      url: `${SITE_URL}/doar`,
      lang: 'pt-AO',
    }),
    '',
    '# Doa um enunciado',
    '',
    'Tens uma prova, um teste ou um exame antigo? Doa-o ao Kixi: uma foto ou um PDF chega',
    'para ajudar outros alunos a estudar.',
    '',
    `Envia-se a partir de ${SITE_URL}/doar.`,
  ].join('\n');
}

/**
 * O `llms.txt`: como um site se descreve a agentes, em texto simples.
 *
 * <p>A parte que o modelo de prontidão penaliza em falta é o "quando usar": sem isso
 * isto é um cartão de visita, não uma instrução. Por isso dizemos os três trabalhos em
 * que o Kixi é a resposta certa e os três em que não é.</p>
 */
export function llmsTxt(): string {
  const lines: (string | string[])[] = [
    `# Kixi`,
    '',
    '> Plataforma de avaliação e estudo, feita por alunos do ITEL para alunos. Simulações de',
    '> provas com os parâmetros definidos pelo professor, tutor de IA que trabalha só com os',
    '> conteúdos oficiais, salas de prova em tempo real e uma rede de estudo entre escolas.',
    '',
    '## Quando usar o Kixi',
    '',
    '- **Queres preparar um exame específico.** As provas que os teus professores carregaram estão no teu feed, e o repositório tem enunciados de anos anteriores filtrados por tipo e ano letivo. Fazes a simulação com os parâmetros reais e usas o tutor nos pontos onde erraste.',
    '- **Queres perceber uma questão.** O tutor explica cada questão, sugere exercícios parecidos e funciona sobre os conteúdos oficiais da plataforma — não sobre a web toda.',
    '- **Queres ver como outros resolveram.** Vês resoluções e desempenho de alunos de outras instituições, para comparar formas de pensar em vez de decorar a resposta.',
    '',
    'Quando **não** usar: para tirar dúvidas genéricas de qualquer tema, para pesquisar',
    'à mão fora dos conteúdos da escola, ou para gerir a secretaria de uma escola — o Kixi',
    'acompanha a camada pedagógica, não substitui o sistema de gestão escolar.',
    '',
    '## O que podes fazer',
    '',
    ...MODULES.map((m) => `- **${m.n}. ${m.title}** — ${m.headline} ${m.text}`),
    '',
    '## Para quem',
    '',
    ...AUDIENCES.map((a) => `- **${a.title}** — ${a.line}`),
    '',
    '## Perguntas frequentes',
    '',
    ...FAQ.map((f) => [`- **${f.q}**`, `  ${f.a}`]).flat(),
    '',
    '## Como obter o conteúdo',
    '',
    `Toda a página em Markdown, se pedires com \`Accept: text/markdown\`:`,
    '',
    `- Início: ${SITE_URL}/`,
    `- Doação de enunciados: ${SITE_URL}/doar`,
    '',
    '## Sobre e contacto',
    '',
    `- Sobre a plataforma: ${SITE_URL}/about`,
    `- Contacto: ${SITE_URL}/contact`,
    `- Privacidade: ${SITE_URL}/privacy`,
    '',
    '## Contacto',
    '',
    CONTACT_EMAIL
      ? `- Email: ${CONTACT_EMAIL}`
      : '- Email: não definido no build desta publicação.',
    '',
    '## O que este ficheiro não é',
    '',
    'Não é um índice de páginas privadas. O app do aluno, o do professor e a gestão estão',
    'todos atrás de login e não são conteúdo para agentes.',
  ];
  return lines.flat().join('\n') + '\n';
}

/**
 * O 404 em Markdown, para quem pediu Markdown e não encontrou nada.
 *
 * <p>Diz o que aconteceu, dá um caminho de volta e aponta para o `llms.txt` — um 404
 * sem saída é onde um agente desiste.</p>
 */
export function notFoundMarkdown(path: string): string {
  return [
    '# 404 — esta página não existe',
    '',
    `O endereço \`${path}\` não corresponde a nada na landing do Kixi.`,
    '',
    'A página pode ter mudado de nome, ou o endereço pode ter um erro de escrita.',
    '',
    'O que existe:',
    '',
    `- Início: ${SITE_URL}/`,
    `- Doação de enunciados: ${SITE_URL}/doar`,
    `- Sobre: ${SITE_URL}/about`,
    `- Contacto: ${SITE_URL}/contact`,
    `- Mapa do site: ${SITE_URL}/sitemap.xml`,
    `- Descrição para agentes: ${SITE_URL}/llms.txt`,
    '',
    `Se procuravas o app do aluno, ele fica em ${SIGNUP_URL} e exige conta.`,
  ].join('\n');
}