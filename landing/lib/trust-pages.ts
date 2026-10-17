/** As páginas de confiança: `/about`, `/contact` e `/privacy` (#218).
 *
 * Vivem em `content.ts` como o resto do texto, e saem daqui para HTML e para Markdown —
 * um agente tem de poder ler a mesma coisa que um humano lê. */

import { CONTACT_EMAIL, MODULES, SITE_URL, SIGNUP_URL } from './content.ts';

/** As três páginas, com o texto e o que cada uma diz no cartão de partilhada.
 *
 *  A rota HTML e a rota de Markdown leem as duas coisas daqui: é o que impede que a
 *  versão indexada e a versão lida por um agente contem histórias diferentes. */
export type TrustPath = keyof typeof TRUST_PAGES;

/** O texto de uma página de confiança em Markdown, ou null se o caminho não for uma. */
export function trustMarkdown(path: string): string | null {
  const key = path.replace(/^\/|\/$/g, '') as TrustPath;
  return key in TRUST_PAGES ? TRUST_PAGES[key].markdown || null : null;
}

export const aboutMd = `# Sobre o Kixi

O Kixi é uma plataforma de avaliação e estudo para escolas, feita por alunos do ITEL
para alunos. Resolve um problema concreto: uma prova defim em segundos e ninguém a
consegue estudar como deve ser.

O que o Kixi faz:

${MODULES.map((m) => `- **${m.n}. ${m.title}** — ${m.headline} ${m.text}`).join('\n')}

O que o Kixi não faz: não substitui o sistema de gestão escolar. Acompanha a camada
pedagógica e de avaliação — o enunciado, a sala, a nota e o feedback. O que a escola
já tem continua onde estava.

## Para quem é

- **Alunos** — simulam provas com os parâmetros que o professor definiu, estudam com o
  tutor e comparam como outras escolas resolveram.
- **Professores** — carregam o enunciado e a chave numa foto, criam salas de prova em
  tempo real e lançam notas sem preencher folhas.
- **Instituições** — acompanham desempenho e lacunas de aprendizagem sem mudar o que já
  usam.

## Onde estamos

- Sítio: ${SITE_URL}/
- Criar conta: ${SIGNUP_URL}
- Contacto: ${SITE_URL}/contact
- Privacidade: ${SITE_URL}/privacy
- Mapa do site: ${SITE_URL}/sitemap.xml
- Descrição para agentes: ${SITE_URL}/llms.txt
`;

export const contactMd = `# Contacto

O Kixi é uma plataforma de avaliação e estudo para escolas, feita por alunos do ITEL.

## Falar connosco

${CONTACT_EMAIL ? `- **Email:** ${CONTACT_EMAIL} — a via mais directa para qualquer assunto sobre a plataforma.` : '- **Email:** não definido nesta publicação.'}

## O que costuma ser mais rápido do que escrever

- **Quero criar conta** — o registo é em ${SIGNUP_URL}, e não pede nada além do essencial.
- **Quero doar uma prova** — ${SITE_URL}/doar aceita uma foto ou um PDF de um enunciado
  antigo. É a forma mais concreta de ajudar outro aluno.
- **Quero saber o que a plataforma faz** — o FAQ está na página inicial, e também em
  ${SITE_URL}/llms.txt em texto simples.

## O que não conseguimos responder por email

- Notas de avaliações já feitas: são responsabilidade da escola que aplicou a prova.
- Problemas de acesso a contas de aluno ou professor.
- Pedidos de remoção de enunciados doados por terceiros.
`;

export const privacyMd = `# Privacidade

O que o Kixi guarda, e porquê. É a descrição do que o sistema faz, não um documento
jurídico: quem responder por esta página é a equipa do Kixi.

## O que uma conta guarda

- **Identificação** — nome, email e palavra-passe com hash. A palavra-passe nunca é
  guardada em claro.
- **Sessão** — um cookie \`auth_token\` guarda o estado da sessão. É httpOnly, expira, e
  não é partilhado com o website público.
- **Desempenho escolar** — notas de simulação, tempo de entrega e acertos, para o
  aluno ver o seu progresso e o professor ver o da turma.

## O que o website público não guarda

A landing não tem analytics nem cookies de seguimento. Um evento de medição só é
guardado depois de consentimento.

## O que sai do sistema e para onde

- **Modelo de linguagem** — o tutor e a leitura de enunciados pedem a um serviço
  externo. O que vai é o conteúdo da pergunta ou do enunciado, não a identidade da
  conta.
- **Reconhecimento de imagem** — a fotografia de um enunciado é processada para virar
  texto, e não fica guardada depois de convertida.

## Quem pode ver o quê

- O aluno vê o seu desempenho e o da turma, e as resoluções partilhadas pelos colegas.
- O professor vê as turmas de que é titular.
- Um enunciado doado por alguém é público para todos os alunos registados, com a
  assinatura que o doador quiser.
- O website público não tem contas nem dados de alunos.

Para o que o sistema faz e o que diz de si, ver ${SITE_URL}/about, ou o mapa do
site em ${SITE_URL}/sitemap.xml.
`;

/** As três páginas, com o texto e o que cada uma diz no cartão de partilhada.
 *
 *  A rota HTML e a rota de Markdown leem as duas coisas daqui: é o que impede que a
 *  versão indexada e a versão lida por um agente contem histórias diferentes. */
export const TRUST_PAGES = {
  about: {
    title: 'Sobre · Kixi',
    description:
      'O Kixi é uma plataforma de avaliação e estudo para escolas: simulações de provas, tutor de IA, salas de prova em tempo real e uma rede de estudo entre escolas. Feita por alunos do ITEL.',
    markdown: aboutMd,
  },
  contact: {
    title: 'Contacto · Kixi',
    description:
      'Como falar com o Kixi: email, criação de conta e doação de enunciados. A via mais rápida para a maioria das dúvidas não é o email.',
    markdown: contactMd,
  },
  privacy: {
    title: 'Privacidade · Kixi',
    description:
      'O que o Kixi guarda, o que não guarda, o que sai do sistema e para onde, e quem vê o quê.',
    markdown: privacyMd,
  },
} as const;
