/** Landing copy, condensed from the Kixi concept document (@creativemode, 2026). */

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '#comecar';

export const NAV = [
  { href: '#solucao', label: 'Solução' },
  { href: '#para-quem', label: 'Para quem' },
] as const;

/** Problems of studying that the ship takes down. */
export const ENEMIES = [
  { label: 'Provas espalhadas', fix: 'Um repositório central' },
  { label: 'Estudo sem feedback', fix: 'Simulações com nota na hora' },
  { label: 'Dúvidas sem resposta', fix: 'Um tutor de IA, 24 h' },
  { label: 'Estudar sozinho', fix: 'Social learning entre escolas' },
] as const;

export const MODULES = [
  { n: '01', title: 'OCR', line: 'Fotografa a prova. O Kixi lê-a.' },
  { n: '02', title: 'Salas de prova', line: 'Notas em segundos, em tempo real.' },
  { n: '03', title: 'Social learning', line: 'Estudar deixa de ser solitário.' },
  { n: '04', title: 'Tutor de IA', line: 'Um tutor que conhece cada questão.' },
  { n: '05', title: 'Dashboard', line: 'O centro de comando.' },
] as const;

export const AUDIENCES = [
  { id: 'alunos', title: 'Alunos', line: 'Estuda exatamente o que foi cobrado.' },
  { id: 'professores', title: 'Professores', line: 'Menos correção, mais tempo para ensinar.' },
  { id: 'instituicoes', title: 'Instituições', line: 'Ajuda a escola sem mudar o que já usa.' },
] as const;

export const FAQ = [
  { q: 'Como carrego uma prova?', a: 'Carregas o enunciado e a chave (P1, Exame…) numa foto ou PDF. O Kixi lê a estrutura e cria a sala de prova, com correção e notas em segundos.' },
  { q: 'Posso acompanhar a minha turma?', a: 'Sim. Vês o tempo de entrega e o desempenho individual e coletivo, e identificas lacunas antes da próxima aula.' },
  { q: 'Posso comparar com outras escolas?', a: 'Sim. Vês como alunos de outras instituições resolveram a mesma prova e comparas desempenhos.' },
  { q: 'O Kixi substitui o sistema de gestão escolar?', a: 'Não, complementa-o. O foco é a camada pedagógica e de avaliação, com regras definidas pelo professor para garantir a integridade das provas.' },
] as const;
