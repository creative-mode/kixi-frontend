import type { Visibility } from './profiles.ts';

/**
 * Regras de denúncia e bloqueio (FE-25, #323).
 *
 * Fica tudo aqui como função pura, como o resto das regras do aluno: o mock e as
 * server actions só aplicam. É o que permite testar as decisões que importam — o que
 * uma denúncia faz ao perfil, o que um bloqueio faz à visibilidade — sem levantar
 * browser nenhum.
 */

/** O que se denuncia. Uma pessoa ou uma escola, nunca as duas coisas de uma vez. */
export type ReportTarget = 'ACCOUNT' | 'INSTITUTION';

/**
 * Motivos de lista fechada, com a nota opcional à parte. Uma lista fechada dá para
 * triar e para contar quantas denúncias há de cada tipo; texto livre não dá, e era
 * o que impedia a fila de ser útil.
 *
 * `BLOCK` é deliberadamente o único motivo que age logo: bloquear é reversível e só
 * affects quem se vê, por isso não precisa de passar por ninguém. Os restantes esperam
 * decisão.
 */
export const REPORT_REASONS = {
  IMPERSONATION: 'Impersonação — está a fazer-se passar por outra pessoa',
  FAKE_SCHOOL: 'Escola falsa — não existe ou foi criada para enganar',
  OFFENSIVE_NAME: 'Nome ofensivo ou impróprio',
  OFFENSIVE_PHOTO: 'Fotografia imprópria',
  MISLEADING_CONTENT: 'Conteúdo enganador',
  BLOCK: 'Bloquear esta pessoa',
  OTHER: 'Outro motivo',
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;

export const REPORT_REASON_KEYS = Object.keys(REPORT_REASONS) as ReportReason[];

/** Motivos que não esperam decisão. Bloquear é local e reversível, não precisa de fila. */
const IMEDIATE: ReadonlySet<ReportReason> = new Set<ReportReason>(['BLOCK']);

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === 'string' && Object.hasOwn(REPORT_REASONS, value);
}

/** Motivos que não precisam de nota escrita. `OTHER` é o único que a exige. */
export function exigeNota(reason: ReportReason): boolean {
  return reason === 'OTHER';
}

export function notaValida(reason: ReportReason, note: string, max = 500): boolean {
  const limpa = note.trim();
  if (exigeNota(reason)) return limpa.length > 0;
  return limpa.length <= max;
}

/**
 * Uma denúncia bem formada. Devolve o motivo errado ou a nota a mais, para a action
 * poder dizer qual dos dois — uma mensagem genérica deixava o aluno sem saber se
 * tinha de escrever a nota.
 */
export function validateReport(input: {
  target: ReportTarget;
  reason: unknown;
  note: string;
  reporterId: number | null;
  targetId: number;
}): { ok: true; reason: ReportReason; note: string } | { ok: false; error: string } {
  if (input.reporterId === null) return { ok: false, error: 'Entra na tua conta para denunciar.' };
  if (!Number.isInteger(input.targetId) || input.targetId <= 0) return { ok: false, error: 'Alvo inválido.' };
  if (input.target !== 'ACCOUNT' && input.target !== 'INSTITUTION') return { ok: false, error: 'Alvo inválido.' };
  if (!isReportReason(input.reason)) return { ok: false, error: 'Escolhe um motivo.' };
  if (!notaValida(input.reason, input.note)) {
    return { ok: false, error: exigeNota(input.reason) ? 'Escreve o motivo.' : 'A nota é demasiado longa.' };
  }
  return { ok: true, reason: input.reason, note: input.note.trim() };
}

/** Se a denúncia vai logo para a fila ou é tratada de imediato. */
export function precisaDecisao(reason: ReportReason): boolean {
  return !IMEDIATE.has(reason);
}

/* ── bloqueio ───────────────────────────────────────────────────────────────
 * Só invisibilidade mútua, como a issue diz: cada um deixa de ver o perfil do
 * outro. Não impede comentários, não impede mensagens e não avisa — é o que o
 * texto pede, e ir mais longe seria inventar política.
 */

export function bloqueadoEntre(blocks: ReadonlyArray<{ accountId: number; blockedAccountId: number }>, a: number, b: number): boolean {
  return blocks.some((x) => (x.accountId === a && x.blockedAccountId === b) || (x.accountId === b && x.blockedAccountId === a));
}

/** O par normalizado, para não guardar o mesmo bloqueio nos dois sentidos. */
export function blockPair(a: number, b: number): { accountId: number; blockedAccountId: number } | null {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0) return null;
  if (a === b) return null; // bloquear-se a si não é um bloqueio
  return a < b ? { accountId: a, blockedAccountId: b } : { accountId: b, blockedAccountId: a };
}

/* ── estado do bloqueio no cliente (kixi#656) ──────────────────────────────
 * O backend responde `{ blocked, blockedByMe }`: `blocked` é o bloqueio nos dois sentidos,
 * `blockedByMe` diz se fui eu a pô-lo, e só quem bloqueou desbloqueia. Um backend antigo
 * não traz `blockedByMe`; nesse caso quem vê `blocked` é quem o pôs (era um toggle de quem
 * carrega no botão), por isso assume-se o mesmo valor.
 */

export interface BlockState {
  blocked: boolean;
  blockedByMe: boolean;
}

export function readBlockState(raw: unknown): BlockState {
  const row = (raw && typeof raw === 'object' ? raw : {}) as { blocked?: unknown; blockedByMe?: unknown };
  const blocked = row.blocked === true;
  return { blocked, blockedByMe: blocked && (typeof row.blockedByMe === 'boolean' ? row.blockedByMe : true) };
}

/** Uma pessoa da lista «Pessoas bloqueadas» (`GET /profiles/blocks`). */
export interface BlockedPerson {
  accountId: number;
  displayName: string;
  photo: string | null;
  blockedAt: string | null;
}

export function readBlockedPeople(raw: unknown): BlockedPerson[] {
  if (!Array.isArray(raw)) return [];
  const out: BlockedPerson[] = [];
  for (const item of raw) {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    if (typeof row.accountId !== 'number' || !Number.isInteger(row.accountId) || row.accountId <= 0) continue;
    out.push({
      accountId: row.accountId,
      displayName: typeof row.displayName === 'string' && row.displayName.trim() ? row.displayName : 'Pessoa sem nome',
      photo: typeof row.photo === 'string' && row.photo ? row.photo : null,
      blockedAt: typeof row.blockedAt === 'string' ? row.blockedAt : null,
    });
  }
  return out;
}

/** O texto do botão do perfil: bloqueia quem ainda não está bloqueado, desbloqueia quem eu bloqueei. */
export function blockButtonLabel(blockedByMe: boolean): string {
  return blockedByMe ? 'Desbloquear' : 'Bloquear';
}

/* ── decisão do moderador ─────────────────────────────────────────────────── */

/** O que cada decisão faz. `IGNORED` não muda nada; as outras mudam o alvo. */
export const DECISIONS = ['IGNORED', 'HIDDEN', 'SUSPENDED'] as const;
export type Decision = (typeof DECISIONS)[number];

export const DECISION_LABELS: Record<Decision, string> = {
  IGNORED: 'Ignorar',
  HIDDEN: 'Ocultar',
  SUSPENDED: 'Suspender',
};

/** Ocultar e suspender só se aplicam a contas; uma escola pode ocultar-se, não suspender-se. */
export function decisaoValida(target: ReportTarget, decision: unknown): decision is Decision {
  if (!DECISIONS.includes(decision as Decision)) return false;
  if (target === 'INSTITUTION' && decision === 'SUSPENDED') return false;
  return true;
}

/**
 * Se um perfil tem de devolver 404 a quem o não é. Um perfil ocultado ou suspenso
 * desaparece para toda a gente menos para quem o decisionor — é o critério de aceitação
 * da issue, e é por isso que isto não olha para quem pergunta.
 */
export function deveDesaparecer(alvo: { hidden?: boolean | null; suspended?: boolean | null }): boolean {
  return Boolean(alvo.hidden || alvo.suspended);
}

/**
 * O perfil tem de desaparecer por completo — 404 — para quem o ocultou, o suspendeu
 * ou o bloqueou.
 *
 * Devolvia `private`, que é o que um perfil «só com nome e foto» devolve, e isso é mais
 * fraco do que a issue pede: «deixa de ver e ser visto». Com `private` o nome e a foto
 * continuam à vista e o bloqueio não bloqueia nada de útil.
 *
 * A si próprio o perfil continua visível: sem esta excepção, denunciar-se a si por
 * engano deixava o aluno a ver o próprio perfil em 404.
 */
export function desaparecePara(options: { mine: boolean; bloqueado: boolean; oculto: boolean }): boolean {
  if (options.mine) return false;
  return options.bloqueado || options.oculto;
}

/** A visibilidade que o próprio escolheu. Só entra quando o perfil não desaparece. */
export function visibilidadePara(options: {
  targetOwnVisibility: Visibility;
  mine: boolean;
  bloqueado: boolean;
  desaparece: boolean;
}): Visibility {
  if (desaparecePara({ mine: options.mine, bloqueado: options.bloqueado, oculto: options.desaparece })) return 'private';
  return options.targetOwnVisibility;
}
