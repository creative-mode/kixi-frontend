/** «Prepara-te para a prova»: a matriz que o professor carregou para uma prova agendada e o treino por temas montado
 *  a partir dela. Regras puras (sem rede nem React) para o `node --test` as alcançar; o contrato é o do backend
 *  (`GET /training/rooms/{id}/plan` e `POST /simulations/practice/matrix`). */

export interface PlanSource {
  statementId: number;
  title: string;
  /** O ano da prova de onde vêm as questões: o backend dá o ano inicial (2023); o mock, o ano letivo («2023/2024»). */
  year: number | string | null;
  count: number;
}

export interface PlanItem {
  topicId: number;
  name: string;
  /** Quantas questões deste tema saem na prova à séria. */
  questionCount: number;
  /** A cotação desse tema na prova, em valores. */
  points: number | null;
  cognitiveLevel: string | null;
  /** Quantas questões deste tema há para treinar, em provas anteriores. */
  available: number;
  sources: PlanSource[];
  /** O que o aluno já tentou e acertou nas questões deste tema. */
  attempted: number;
  correct: number;
}

export interface TrainingPlan {
  roomId: number;
  subjectId: number | null;
  subjectName: string | null;
  statementTitle: string | null;
  startsAt: string;
  durationMinutes: number | null;
  totalPoints: number;
  items: PlanItem[];
}

export interface MatrixPick {
  topicId: number;
  count: number;
}

export type Preset = 'prova' | 'dobro' | 'fracos';

const LEVELS: Record<string, string> = {
  KNOWLEDGE: 'Conhecimento',
  COMPREHENSION: 'Compreensão',
  APPLICATION: 'Aplicação',
  ANALYSIS: 'Análise',
};

/** O nível cognitivo (taxonomia de Bloom, como nas matrizes das escolas) por extenso. */
export function levelLabel(level: string | null): string | null {
  if (!level) return null;
  return LEVELS[level.toUpperCase()] ?? null;
}

/** Quantas questões se podem pedir de um tema: nunca mais do que há, nunca menos que zero. */
export function clampCount(count: number, item: Pick<PlanItem, 'available'>): number {
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.min(Math.floor(count), item.available));
}

/** «Fraco» = já tentou o suficiente para haver sinal e acertou menos de 60 %. Quem nunca tentou também precisa de treino. */
export function masteryOf(item: Pick<PlanItem, 'attempted' | 'correct'>): { pct: number | null; weak: boolean } {
  if (item.attempted <= 0) return { pct: null, weak: true };
  const pct = Math.round((item.correct / item.attempted) * 100);
  return { pct, weak: pct < 60 };
}

/** O ponto de partida do treino: «como na prova» (as quantidades da matriz), o dobro, ou mais nos temas fracos. */
export function presetCounts(items: readonly PlanItem[], preset: Preset): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const item of items) {
    let wanted = item.questionCount;
    if (preset === 'dobro') wanted = item.questionCount * 2;
    if (preset === 'fracos') wanted = masteryOf(item).weak ? item.questionCount * 2 : Math.max(1, Math.ceil(item.questionCount / 2));
    counts[item.topicId] = clampCount(wanted, item);
  }
  return counts;
}

export interface PlanSummary {
  questions: number;
  /** O tempo proporcional ao da prova: a mesma duração por questão, com o mínimo de 5 minutos. */
  minutes: number | null;
  /** Os temas com menos questões disponíveis do que as pedidas, para o ecrã avisar. */
  short: number;
}

export function summarize(plan: Pick<TrainingPlan, 'durationMinutes' | 'items'>, counts: Record<number, number>): PlanSummary {
  const questions = plan.items.reduce((n, item) => n + clampCount(counts[item.topicId] ?? 0, item), 0);
  const examQuestions = plan.items.reduce((n, item) => n + item.questionCount, 0);
  const minutes =
    plan.durationMinutes && examQuestions > 0 && questions > 0
      ? Math.max(5, Math.round((plan.durationMinutes * questions) / examQuestions))
      : null;
  const short = plan.items.filter((item) => item.available < item.questionCount).length;
  return { questions, minutes, short };
}

/** Os pedidos que seguem para o servidor: só os temas com pelo menos uma questão. */
export function picksOf(plan: Pick<TrainingPlan, 'items'>, counts: Record<number, number>): MatrixPick[] {
  return plan.items
    .map((item) => ({ topicId: item.topicId, count: clampCount(counts[item.topicId] ?? 0, item) }))
    .filter((pick) => pick.count > 0);
}

/** «12 questões de 4 provas · 2022 a 2024»: de onde vêm as questões que o aluno tem para treinar. */
export function sourcesLabel(item: Pick<PlanItem, 'available' | 'sources'>): string {
  if (item.available <= 0) return 'Ainda sem questões deste tema';
  const years = item.sources.map((s) => (s.year == null ? NaN : Number(String(s.year).slice(0, 4)))).filter(Number.isFinite);
  const provas = item.sources.length;
  const base = `${item.available} ${item.available === 1 ? 'questão' : 'questões'} de ${provas} ${provas === 1 ? 'prova' : 'provas'}`;
  if (years.length === 0) return base;
  const from = Math.min(...years);
  const to = Math.max(...years);
  return from === to ? `${base} · ${from}` : `${base} · ${from} a ${to}`;
}

/** Valores com vírgula decimal, como se escrevem as notas em Angola: «4,5». */
export function valuesLabel(points: number | null): string | null {
  if (points == null || !Number.isFinite(points)) return null;
  return `${Number.isInteger(points) ? points : String(points).replace('.', ',')} ${points === 1 ? 'valor' : 'valores'}`;
}
