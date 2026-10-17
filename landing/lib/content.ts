/** Landing copy, taken from the Kixi concept document (@creativemode, 2026). */

/** O app do aluno vive no mesmo endereço, em /aluno (gateway). NEXT_PUBLIC_APP_URL só é preciso se estiver noutro domínio. */
const APP = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
export const LOGIN_URL = `${APP}/aluno/entrar`;
export const SIGNUP_URL = `${APP}/aluno/cadastro`;

/** Endereço público da landing, para o canonical, o Open Graph e o sitemap. Entra no build (ARG do Dockerfile); vazio cai no de produção. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://kixi.creativemode.ao').replace(/\/$/, '');

/** Só aparece no rodapé quando está definido: não inventamos um endereço de contacto. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '';

/**
 * Morada postal e telefone, para o `Organization` que os agentes usam para responder a
 * perguntas de contacto (#218).
 *
 * <p>Saem do build e não estão no código porque são dados de uma entidade real: quem os
 * escrever aqui é que os declara. Sem eles o JSON-LD vai sem `address` e sem telefone —
 * meio contacto é pior do que nenhum, porque parece verificado quando não está.</p>
 */
export const CONTACT_POSTAL_ADDRESS = {
  street: process.env.NEXT_PUBLIC_CONTACT_STREET ?? '',
  locality: process.env.NEXT_PUBLIC_CONTACT_LOCALITY ?? '',
  postalCode: process.env.NEXT_PUBLIC_CONTACT_POSTAL_CODE ?? '',
  addressCountry: process.env.NEXT_PUBLIC_CONTACT_COUNTRY ?? 'AO',
} as const;

export const CONTACT_PHONE = process.env.NEXT_PUBLIC_CONTACT_PHONE ?? '';

export const NAV = [
  { href: '#solucao', label: 'Solução' },
  { href: '#modulos', label: 'Módulos' },
  { href: '#para-quem', label: 'Para quem' },
  { href: '#perguntas', label: 'Perguntas' },
] as const;

export const MODULES = [
  { n: 'I', title: 'OCR', headline: 'Fotografa a prova. O Kixi lê-a.', text: 'Converte fotos ou PDF em texto editável e estruturado. Identifica o cabeçalho, separa as perguntas das opções e reconhece as pontuações, sem erros de transcrição.' },
  { n: 'II', title: 'Gestão pedagógica', headline: 'Salas de prova em tempo real.', text: 'O professor carrega o enunciado e a chave (P1, Exame…), liga-o a escola, ano letivo, classe e disciplina e cria salas de prova. As notas saem em decimais, com feedback instantâneo.' },
  { n: 'III', title: 'Social learning', headline: 'Estudar deixa de ser solitário.', text: 'O teu feed mostra o que é da tua escola e do teu currículo. Simulas, estudas com a IA e comparas resoluções e desempenho com alunos de outras instituições.' },
  { n: 'IV', title: 'Tutor de IA', headline: 'Um tutor que conhece cada questão.', text: 'Trabalha só com os conteúdos oficiais da plataforma. Analisa uma questão, sugere exercícios parecidos e tira dúvidas sobre conceitos complexos.' },
  { n: 'V', title: 'Dashboard', headline: 'O centro de comando.', text: 'Visão 360º e controlo em tempo real para professores, alunos e instituições: tempo de entrega, desempenho individual e da turma.' },
] as const;

export const AUDIENCES = [
  { id: 'alunos', title: 'Alunos', line: 'Estuda exatamente o que foi cobrado.', items: ['Simulações reais, com os parâmetros definidos pelo professor.', 'Repositório de anos anteriores, filtrado por tipo de prova e ano letivo.', 'Tutor de IA para os pontos onde tiveste dificuldade.', 'Vê como outras escolas resolveram a mesma prova e compara.'] },
  { id: 'professores', title: 'Professores', line: 'Menos correção, mais tempo para ensinar.', items: ['Carrega o enunciado e a chave (P1, Exame…) numa foto.', 'Cria salas de prova e aplica avaliações controladas.', 'Notas lançadas em segundos, em frações decimais.', 'Identifica lacunas de aprendizagem antes da próxima aula.'] },
  { id: 'instituicoes', title: 'Instituições', line: 'Ajuda a escola sem mudar o que já usa.', items: ['Não substitui o sistema de gestão escolar: acrescenta a camada pedagógica.', 'Menos burocracia e um ciclo de aprendizagem mais rápido.', 'Integridade das provas garantida por regras definidas pelo professor.'] },
] as const;

export const FAQ = [
  { group: 'Professores', q: 'Como funciona o carregamento de provas e enunciados?', a: 'Carregas o enunciado e a chave (P1, Exame, etc.) diretamente no sistema. A IA processa esses parâmetros para criares salas virtuais, aplicares provas em tempo real e obteres a correção e o lançamento de notas em frações de segundo.' },
  { group: 'Professores', q: 'Posso monitorizar o desempenho da minha turma?', a: 'Sim. O Kixi dá métricas precisas sobre o tempo de entrega e o desempenho individual e coletivo, para identificares lacunas de aprendizagem antes mesmo da próxima aula.' },
  { group: 'Alunos', q: 'Como é que o Kixi me ajuda a preparar um exame específico?', a: 'No teu feed tens as provas carregadas pelos teus professores e, no repositório, os enunciados dos anos anteriores filtrados por tipo de prova e ano letivo. Fazes simulações reais com os parâmetros definidos por eles e usas o assistente de IA para estudar os pontos onde tiveste dificuldade.' },
  { group: 'Alunos', q: 'Posso interagir com alunos de outras escolas?', a: 'Sim. Vês como alunos de outras instituições resolveram a mesma prova, comparas desempenhos e trocas conhecimento, numa rede de estudo nacional e internacional.' },
  { group: 'Instituições', q: 'O Kixi substitui o sistema de gestão escolar?', a: 'Não, complementa-o. O foco é a camada pedagógica e de avaliação. A rapidez das notas e o feedback direcionado reduzem a burocracia e aceleram o ciclo de aprendizagem.' },
  { group: 'Instituições', q: 'Como é garantida a integridade das provas?', a: 'O sistema é blindado por regras definidas pelo professor, como o tempo de entrega e parâmetros específicos, para que a tecnologia avalie o conhecimento real de forma justa e transparente.' },
] as const;
