export type PostKind = 'exam' | 'milestone' | 'doubt' | 'topic';

export interface FeedPost {
  id: string;
  kind: PostKind;
  name: string;
  meta: string;
  text: string;
  claps: number;
  forces: number;
  comments: number;
  cta: { label: string; href: string };
  exam?: { title: string; meta: string; delta?: string; grade: string };
  reward?: { label: string; icon: string; tone: 'tiro' | 'pop' };
  fresh?: boolean;
}

export const stories = [
  { name: 'Mariana Costa', value: '18,2', hue: 'tiro', seen: false },
  { name: 'Paulo Neto', value: '30 DIAS', hue: 'tiro', seen: false },
  { name: 'Inês Lopes', value: 'VLANs', hue: 'pop', seen: false },
  { name: 'Nuno Dias', value: '+2,5', hue: 'radar', seen: true },
  { name: 'Sara Pinto', value: 'DÚVIDA', hue: 'lila', seen: true },
] as const;

export const posts: FeedPost[] = [
  { id: 'a', kind: 'exam', name: 'Mariana Costa', meta: '12B · ITEL · há 2 h', text: 'Fiz a simulação da P1 de Redes. Subnetting finalmente entrou!', claps: 24, forces: 9, comments: 6, cta: { label: 'Fazer esta prova', href: '/prova/redes-p1' }, exam: { title: 'P1 · Redes de Computadores', meta: 'ITEL 2024', delta: '+3,0 QUE A ÚLTIMA', grade: '18,2' } },
  { id: 'b', kind: 'milestone', name: 'Paulo Neto', meta: '12A · ITEL · há 5 h', text: '30 dias seguidos a estudar. A pausa grátis salvou-me duas vezes.', claps: 41, forces: 18, comments: 12, cta: { label: 'Ver perfil', href: '/perfil' }, reward: { label: '30 dias seguidos', icon: 'shot', tone: 'tiro' }, fresh: true },
  { id: 'c', kind: 'doubt', name: 'Sara Pinto', meta: '12B · ITEL · ontem', text: 'Alguém percebeu a Q4 do exame de Matemática Discreta 2023? Não estou a ver a indução.', claps: 6, forces: 2, comments: 4, cta: { label: 'Abrir no tutor', href: '/tutor' } },
  { id: 'd', kind: 'topic', name: 'Inês Lopes', meta: '12B · ITEL · ontem', text: 'VLANs: de 40% para 90% de domínio numa semana. O tutor ajudou muito.', claps: 17, forces: 6, comments: 3, cta: { label: 'Estudar VLANs', href: '/provas' }, reward: { label: 'VLANs derrotado', icon: 'target', tone: 'pop' } },
];

export const KIND_BAND: Record<PostKind, { cls: string; tone: string; label: string }> = {
  exam: { cls: '', tone: 'success', label: 'Prova feita' },
  milestone: { cls: ' kx-post--tiro', tone: 'reward', label: 'Marco' },
  doubt: { cls: ' kx-post--radar', tone: 'info', label: 'Dúvida' },
  topic: { cls: ' kx-post--pop', tone: 'pop', label: 'Tema derrotado' },
};

export const exams = [
  { id: 'redes-p1', kind: 'P1', title: 'Redes de Computadores', subject: 'Redes', school: 'ITEL', year: '2024', status: 'Em curso', tone: 'warning', mastery: 64 },
  { id: 'so-p2', kind: 'P2', title: 'Sistemas Operativos', subject: 'SO', school: 'ITEL', year: '2024', status: 'Corrigida', tone: 'success', mastery: 82 },
  { id: 'md-exame', kind: 'Exame', title: 'Matemática Discreta', subject: 'Matemática', school: 'ISPTEC', year: '2023', status: 'Nova', tone: 'reward', mastery: 30 },
  { id: 'poo-p1', kind: 'P1', title: 'Programação Orientada a Objetos', subject: 'Programação', school: 'ITEL', year: '2024', status: 'Aberta', tone: 'info', mastery: undefined },
] as const;

export const subjects = ['Todas', 'Redes', 'Programação', 'Matemática', 'SO'] as const;

export const question = {
  number: 5,
  total: 12,
  points: '1,5',
  text: 'Uma rede usa o endereço 192.168.10.0/26. Qual é o endereço de broadcast da primeira sub-rede?',
  options: ['192.168.10.31', '192.168.10.63', '192.168.10.64', '192.168.10.127'],
};

export const questionCells = ['correct', 'correct', 'wrong', 'correct', 'current', 'pending', 'pending', 'skipped', 'pending', 'pending', 'pending', 'pending'];

export const ranking = {
  Turma: { title: 'Turma 12B', rows: [
    { rank: 1, name: 'Mariana Costa', school: 'ITEL', score: '18,2' },
    { rank: 2, name: 'Paulo Neto', school: 'ITEL', score: '17,6' },
    { rank: 3, name: 'Sara Pinto', school: 'ITEL', score: '16,9' },
    { rank: 4, name: 'Nuno Dias', school: 'ITEL', score: '15,4' },
    { rank: 5, name: 'Abner Ede', school: 'ITEL', score: '15,0', you: true },
    { rank: 6, name: 'Inês Lopes', school: 'ITEL', score: '14,6' },
  ] },
  Escola: { title: 'ITEL', rows: [
    { rank: 1, name: 'Helder Gomes', school: 'ITEL', score: '19,1' },
    { rank: 2, name: 'Mariana Costa', school: 'ITEL', score: '18,2' },
    { rank: 3, name: 'Paulo Neto', school: 'ITEL', score: '17,6' },
    { rank: 11, name: 'Nuno Dias', school: 'ITEL', score: '15,4' },
    { rank: 12, name: 'Abner Ede', school: 'ITEL', score: '15,0', you: true },
    { rank: 13, name: 'Inês Lopes', school: 'ITEL', score: '14,6' },
  ] },
  Amigos: { title: 'Os teus amigos', rows: [
    { rank: 1, name: 'Paulo Neto', school: 'ITEL', score: '17,6' },
    { rank: 2, name: 'Nuno Dias', school: 'ITEL', score: '15,4' },
    { rank: 3, name: 'Abner Ede', school: 'ITEL', score: '15,0', you: true },
  ] },
} as const;

export const tutorChat = [
  { from: 'student', text: 'Não percebi a questão 3. Porque é que não é .63?' },
  { from: 'tutor', source: 'P1 · ITEL 2024 · Q3', text: 'Boa pergunta. A Q3 pede o endereço de rede, não o de broadcast. Com /26 cada sub-rede tem 64 endereços: a primeira vai de .0 a .63, por isso a rede é .0.' },
  { from: 'student', text: 'E a segunda sub-rede?' },
  { from: 'tutor', source: 'P1 · ITEL 2024 · Q3', text: 'Começa em .64. Tenta tu: qual é o broadcast dela?' },
] as const;

export const tutorChips = ['Dá-me uma dica', 'Explica em binário', 'Outra questão igual'];

export const suggestions = [
  { name: 'Helder Gomes', meta: '12A · ITEL · 19,1 de média' },
  { name: 'Beatriz Lima', meta: '11B · ISPTEC · Redes' },
  { name: 'Tomás Reis', meta: '12B · ITEL · 21 dias seguidos' },
] as const;

export const trending = [
  { tag: 'Subnetting', count: 48 },
  { tag: 'Indução', count: 31 },
  { tag: 'VLANs', count: 27 },
  { tag: 'Exame de POO', count: 19 },
] as const;
