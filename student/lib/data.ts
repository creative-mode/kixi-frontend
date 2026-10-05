/** Dados de exemplo. Ainda não há ligação à API do backend. */

export const me = { name: 'Abner Ede', turma: '12B', escola: 'ITEL', curso: 'Informática' };

export type PostKind = 'resultado' | 'duvida' | 'dica';

export interface Comment { name: string; text: string; time: string }
export interface FeedPost {
  id: string;
  kind: PostKind;
  name: string;
  meta: string;
  text: string;
  useful: number;
  comments: Comment[];
  attach?:
    | { type: 'resultado'; title: string; meta: string; score: string; delta?: string; href: string }
    | { type: 'questao'; title: string; excerpt: string }
    | { type: 'tema'; title: string; meta: string; href: string };
  cta?: { label: string; href: string };
}

export const KIND_LABEL: Record<PostKind, string> = { resultado: 'Resultado', duvida: 'Dúvida', dica: 'Dica de estudo' };

export const posts: FeedPost[] = [
  {
    id: 'a', kind: 'resultado', name: 'Mariana Costa', meta: '12B · ITEL · há 2 h',
    text: 'Fiz a simulação da P1 de Redes. O subnetting finalmente entrou depois de refazer as questões 3 e 8 com o tutor.',
    useful: 24,
    comments: [
      { name: 'Paulo Neto', text: 'Boa! Foi o que me ajudou também. Fizeste a de SO?', time: 'há 1 h' },
      { name: 'Inês Lopes', text: 'Passas-me a tua folha de máscaras?', time: 'há 40 min' },
    ],
    attach: { type: 'resultado', title: 'P1 · Redes de Computadores', meta: 'ITEL 2024', score: '18,2', delta: '+3,0 face à anterior', href: '/prova/redes-p1' },
    cta: { label: 'Fazer esta prova', href: '/prova/redes-p1' },
  },
  {
    id: 'c', kind: 'duvida', name: 'Sara Pinto', meta: '12B · ITEL · ontem',
    text: 'Alguém percebeu a Q4 do exame de Matemática Discreta de 2023? Não estou a ver como se faz a indução.',
    useful: 6,
    comments: [{ name: 'Nuno Dias', text: 'Começa pelo caso base n = 1 e escreve a hipótese antes de mexer na soma.', time: 'há 18 h' }],
    attach: { type: 'questao', title: 'Matemática Discreta · Exame 2023 · Q4', excerpt: 'Demonstre por indução que 1 + 2 + … + n = n(n + 1) / 2.' },
    cta: { label: 'Abrir no tutor', href: '/tutor' },
  },
  {
    id: 'b', kind: 'dica', name: 'Paulo Neto', meta: '12A · ITEL · ontem',
    text: 'O que me ajudou esta semana: dez minutos por dia só com os erros da última simulação. Em VLANs passei de 40% para 90% de domínio.',
    useful: 41,
    comments: [],
    attach: { type: 'tema', title: 'VLANs', meta: 'Redes de Computadores · 12 questões', href: '/provas' },
  },
];

export interface Exam { id: string; kind: string; title: string; subject: string; school: string; year: string; state: 'progress' | 'done' | 'new'; done?: number; total?: number; score?: string; mastery?: number }
export const exams: Exam[] = [
  { id: 'redes-p1', kind: 'P1', title: 'Redes de Computadores', subject: 'Redes', school: 'ITEL', year: '2024', state: 'progress', done: 5, total: 12 },
  { id: 'so-p2', kind: 'P2', title: 'Sistemas Operativos', subject: 'SO', school: 'ITEL', year: '2024', state: 'done', score: '16,4', mastery: 82 },
  { id: 'md-exame', kind: 'Exame', title: 'Matemática Discreta', subject: 'Matemática', school: 'ISPTEC', year: '2023', state: 'new', mastery: 30 },
  { id: 'poo-p1', kind: 'P1', title: 'Programação Orientada a Objetos', subject: 'Programação', school: 'ITEL', year: '2024', state: 'new' },
];

export const subjects = ['Todas', 'Redes', 'Programação', 'Matemática', 'SO'] as const;

export const topicsToReview = [
  { label: 'Subnetting', value: 34 },
  { label: 'Roteamento', value: 58 },
  { label: 'Indução', value: 47 },
];

export const upcoming = [
  { day: '22', month: 'out', title: 'P2 · Redes de Computadores', meta: 'Turma 12B' },
  { day: '29', month: 'out', title: 'Exame · Matemática Discreta', meta: 'Sala 4' },
];

export const question = {
  number: 5,
  total: 12,
  points: '1,5',
  text: 'Uma rede usa o endereço 192.168.10.0/26. Qual é o endereço de broadcast da primeira sub-rede?',
  options: ['192.168.10.31', '192.168.10.63', '192.168.10.64', '192.168.10.127'],
};

/** Estado de cada questão na navegação: respondida, marcada, por responder. */
export const questionCells: ('done' | 'flag' | 'empty')[] = ['done', 'done', 'done', 'flag', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'];

export const result = {
  title: 'P1 · Redes de Computadores',
  score: '15,0',
  delta: '+2,5 face à anterior',
  correct: '9 de 12',
  time: '41 min',
  place: '5.º de 28',
  topics: [
    { label: 'VLANs', value: 92 },
    { label: 'Roteamento', value: 58 },
    { label: 'Subnetting', value: 34 },
  ],
  wrong: [
    { q: 'Q3', topic: 'Subnetting', text: 'Endereço de rede de uma sub-rede /26' },
    { q: 'Q8', topic: 'Subnetting', text: 'Número de máquinas por sub-rede' },
    { q: 'Q11', topic: 'Roteamento', text: 'Rota estática ou dinâmica?' },
  ],
};

export const ranking = {
  Turma: { title: 'Turma 12B', rows: [
    { rank: 1, name: 'Mariana Costa', school: 'ITEL', score: '18,2', exams: 14 },
    { rank: 2, name: 'Paulo Neto', school: 'ITEL', score: '17,6', exams: 12 },
    { rank: 3, name: 'Sara Pinto', school: 'ITEL', score: '16,9', exams: 11 },
    { rank: 4, name: 'Nuno Dias', school: 'ITEL', score: '15,4', exams: 9 },
    { rank: 5, name: 'Abner Ede', school: 'ITEL', score: '15,0', exams: 8, you: true },
    { rank: 6, name: 'Inês Lopes', school: 'ITEL', score: '14,6', exams: 10 },
  ] },
  Escola: { title: 'ITEL', rows: [
    { rank: 1, name: 'Helder Gomes', school: 'ITEL', score: '19,1', exams: 21 },
    { rank: 2, name: 'Mariana Costa', school: 'ITEL', score: '18,2', exams: 14 },
    { rank: 3, name: 'Paulo Neto', school: 'ITEL', score: '17,6', exams: 12 },
    { rank: 11, name: 'Nuno Dias', school: 'ITEL', score: '15,4', exams: 9 },
    { rank: 12, name: 'Abner Ede', school: 'ITEL', score: '15,0', exams: 8, you: true },
    { rank: 13, name: 'Inês Lopes', school: 'ITEL', score: '14,6', exams: 10 },
  ] },
  Amigos: { title: 'Os teus amigos', rows: [
    { rank: 1, name: 'Paulo Neto', school: 'ITEL', score: '17,6', exams: 12 },
    { rank: 2, name: 'Nuno Dias', school: 'ITEL', score: '15,4', exams: 9 },
    { rank: 3, name: 'Abner Ede', school: 'ITEL', score: '15,0', exams: 8, you: true },
  ] },
} as const;

export const tutorChat = [
  { from: 'student', text: 'Não percebi a questão 3. Porque é que não é .63?' },
  { from: 'tutor', source: 'P1 · ITEL 2024 · Q3', text: 'A Q3 pede o endereço de rede, não o de broadcast. Com /26 cada sub-rede tem 64 endereços: a primeira vai de .0 a .63, por isso o endereço de rede é .0 e o de broadcast é .63.' },
  { from: 'student', text: 'E a segunda sub-rede?' },
  { from: 'tutor', source: 'P1 · ITEL 2024 · Q3', text: 'Começa em .64. Experimenta: qual é o endereço de broadcast dela?' },
] as const;

export const tutorChips = ['Dá-me uma dica', 'Explica em binário', 'Outra questão igual'];
