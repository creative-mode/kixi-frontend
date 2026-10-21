/**
 * Modo de avaliação (#192): o que conta como evento, quando é que um evento se
 * regista, e o que o aluno lê. Puro e sem React, para o `node --test` o alcançar —
 * a mesma razão de `exam-rules.ts`.
 *
 * Isto **não** substitui um lockdown browser, proctoring nem supervisão presencial.
 * Um website não trava outro dispositivo, outro navegador nem uma fotografia do
 * ecrã; o que faz, e é só isto, é registar com aviso o que o browser consegue ver,
 * e travar a saída mais fácil (o tutor da própria prova). Nada aqui reprova o
 * aluno: os eventos ficam para o professor decidir.
 */

import { acceptsAnswers, attemptFor, type SimulationSummary } from './exam-rules.ts';

/**
 * Os eventos que o modo de avaliação regista.
 *
 * Mudar esta lista obriga a mudar três sítios: aqui, a lista do gestor
 * (`lib/exam-rooms/model.ts`) e o contrato do backend. Os três falam dos mesmos
 * nomes, e há um teste de cada lado a fixá-los, como nas denúncias (#323).
 */
export type IntegrityKind =
  | 'TAB_HIDDEN'
  | 'TAB_VISIBLE'
  | 'WINDOW_BLUR'
  | 'WINDOW_FOCUS'
  | 'PASTE_BLOCKED'
  | 'TUTOR_BLOCKED';

export const INTEGRITY_KINDS: readonly IntegrityKind[] = [
  'TAB_HIDDEN',
  'TAB_VISIBLE',
  'WINDOW_BLUR',
  'WINDOW_FOCUS',
  'PASTE_BLOCKED',
  'TUTOR_BLOCKED',
];

export function isIntegrityKind(value: unknown): value is IntegrityKind {
  return typeof value === 'string' && (INTEGRITY_KINDS as readonly string[]).includes(value);
}

/** A recusa do `POST /simulations/{id}/integrity-events`, com o estado que o
 *  backend usa. Os 400 são sempre sobre a questão. */
export interface IntegrityRefusal {
  status: 400 | 404 | 409;
  message: string;
}

/**
 * As regras do `SimulationIntegrityEventService` que dependem da tentativa, depois de
 * o tipo já ser conhecido: a questão (só no `PASTE_BLOCKED`, e desta prova) e a
 * tentativa (a decorrer, dentro do prazo). A tentativa entra já resolvida — `null`
 * quando não existe ou não é desta conta — para a regra ser testável sem o mock.
 */
export function integrityRefusal(input: {
  kind: IntegrityKind;
  questionId: number | null;
  attempt: { active: boolean; expired: boolean; questionBelongs: boolean | null } | null;
}): IntegrityRefusal | null {
  if (input.kind === 'PASTE_BLOCKED' && input.questionId === null) {
    return { status: 400, message: 'questionId é obrigatório no PASTE_BLOCKED' };
  }
  if (input.kind !== 'PASTE_BLOCKED' && input.questionId !== null) {
    return { status: 400, message: 'questionId só é aceite no PASTE_BLOCKED' };
  }
  if (input.attempt === null) return { status: 404, message: 'Simulation not found' };
  if (!input.attempt.active) {
    return { status: 409, message: 'Integrity events are only accepted for an active simulation' };
  }
  if (input.attempt.expired) {
    return { status: 409, message: 'The time allowed for this simulation has expired' };
  }
  if (input.attempt.questionBelongs === false) {
    return { status: 400, message: 'A questão não pertence a esta prova' };
  }
  return null;
}

export interface IntegrityEvent {
  kind: IntegrityKind;
  /** Milissegundos do relógio do browser, só para o `shouldRecord` decidir. O que
   *  fica guardado é a hora do servidor, carimbada por ele. */
  at: number;
  questionId?: number | null;
}

/** O modo de avaliação só corre numa tentativa a decorrer. Fora dela (entregue,
 *  cancelada, expirada) não há nada para vigiar. */
export function integridadeAplica(status: string | null | undefined): boolean {
  return (status ?? '').toUpperCase() === 'IN_PROGRESS';
}

/** A mesma troca de separador dispara mais do que um sinal: esconder o separador
 *  levanta `TAB_HIDDEN` e `WINDOW_BLUR`, voltar levanta `TAB_VISIBLE` e
 *  `WINDOW_FOCUS`. São duas marcas por saída, não quatro, e o gestor lê uma.
 *  Ficar com a primeira de cada par é o que faz "uma troca, um evento". */
const AWAY: readonly IntegrityKind[] = ['TAB_HIDDEN', 'WINDOW_BLUR'];
const BACK: readonly IntegrityKind[] = ['TAB_VISIBLE', 'WINDOW_FOCUS'];

const groupOf = (kind: IntegrityKind): readonly IntegrityKind[] =>
  AWAY.includes(kind) ? AWAY : BACK.includes(kind) ? BACK : [kind];

/** Espera mínima entre eventos equivalentes. Dentro dela o mesmo sinal é ruído —
 *  um `blur`/`focus` a piscar, uma rajada de colagens recusadas, um `focus` logo a
 *  seguir a `visible`. */
export const COALESCE_MS = 2000;

/**
 * Se um evento de `kind` a `at` vale a pena registar, dado o que já se registou:
 * outro evento do mesmo grupo dentro de `windowMs` engole-o.
 *
 * O grupo e não o tipo: `TAB_HIDDEN` e `WINDOW_BLUR` são a mesma saída, e registar
 * as duas contaria o dobro. Tipos de grupos diferentes contam sempre.
 */
export function shouldRecord(
  recorded: readonly IntegrityEvent[],
  kind: IntegrityKind,
  at: number,
  windowMs: number = COALESCE_MS,
): boolean {
  const group = groupOf(kind);
  const last = [...recorded].reverse().find((e) => group.includes(e.kind));
  return !last || at - last.at >= windowMs;
}

/**
 * O que o aluno lê. Sair não se vê — o ecrã está noutro lado — por isso o aviso
 * aparece **ao voltar**: vê-se o que ficou registado em vez de um silêncio.
 * Devolve `null` para os eventos que não precisam de aviso próprio (a colagem tem
 * o seu, junto ao campo, e não no topo).
 */
export function noticeFor(kind: IntegrityKind): string | null {
  if (kind === 'TAB_VISIBLE' || kind === 'WINDOW_FOCUS') {
    return 'Voltaste à prova. O tempo em que estiveste fora ficou registado. Podes continuar a responder.';
  }
  return null;
}

/** A resposta ao gesto de colar, mostrada junto ao campo onde se tentou colar. */
export const PASTE_NOTICE = 'Colar está desativado durante a simulação. Escreve a resposta.';

/** Numa questão de escolha não há onde colar. Só as respostas abertas recusam
 *  colagem: assim não se bloqueia o que não está em causa, e a acessibilidade do
 *  resto do ecrã fica intacta. */
export function pasteBlocked(question: { options: unknown[] }): boolean {
  return question.options.length === 0;
}

/**
 * A tentativa a decorrer desta prova, se houver — é o que fecha o tutor. O
 * `acceptsAnswers` traz as duas condições: `IN_PROGRESS` e prazo por passar, para
 * uma tentativa expirada (que o servidor ainda não fechou) não deixar o aluno
 * preso sem tutor.
 */
export function tentativaViva(
  simulations: SimulationSummary[],
  statementId: number,
  now: number,
): SimulationSummary | null {
  const attempt = attemptFor(simulations, statementId);
  return attempt && acceptsAnswers(attempt, now) ? attempt : null;
}
