/** As páginas de confiança: `/about` e `/contact` (#218).
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
para alunos. Resolve um problema concreto: uma prova fica disponível em segundos e ninguém
tem dificuldade em a estudar como deve ser.

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
- Privacidade: ${SITE_URL}/privacidade
- Cookies: ${SITE_URL}/cookies
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
  }
} as const;
