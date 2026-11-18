import 'server-only';

import { cache } from 'react';
import { apiGet } from './api';
import { getBadges } from './stats';
import { parseServerTime } from './exam-rules';
import { getFeed, getComments } from './feed';
import { correctionNoticeOf } from './correction-notice';
import { listInvitations } from './exam-room';
import { listSimulationsResult } from './exam';
import { sufixoDaNota } from './nota-da-simulacao';
import { correcaoDaSimulacao, correcaoLigada } from './schoolops/correcao';
import { eSimulacaoLivre, escalaDaNota } from './schoolops/correcao-rules';
import type { RawSimulation } from './performance-rules';
import type { Me } from './types';

export interface Notification {
  key: string;
  kind: 'reply' | 'badge' | 'result' | 'correction';
  /** Quem fez, quando há uma pessoa (resposta à tua pergunta). */
  who: string | null;
  text: string;
  href: string;
  at: string;
  unread: boolean;
}

export interface Notifications {
  items: Notification[];
  unreadCount: number;
  /** Só as notificações de nota por ver: acende o ponto na entrada «Provas». */
  unreadCorrections: number;
}

/** Até quando o aluno já viu as notificações; sem registo, nada foi lido. */
async function readAtOf(): Promise<number> {
  const r = await apiGet<{ readAt?: string }>('/me/notifications');
  const at = r.ok ? r.data?.readAt : undefined;
  return at ? parseServerTime(at) || 0 : 0;
}

type NotaMotor = { score: number; scale: number };
type NotasDoMotor = { grades: Map<number, NotaMotor>; livres: Set<number> } | null;

/** Só as cinco correções mais recentes: cada uma custa duas chamadas ao motor e isto
 *  corre no servidor, por página. As mais antigas ficam sem número antes de ficarem
 *  com um número da escala errada. */
const MAX_NOTAS_MOTOR = 5;

/**
 * A nota do resultado vem do SchoolOps (0–20); a lista `/simulations` só traz os pontos
 * da prova, que podem não somar 20 (#817). O sino tem de dizer o mesmo que o resultado,
 * por isso a nota é pedida ao motor para as simulações livres já corrigidas.
 *
 * Só se pede na página de notificações — a barra lê `loadNotifications` em todas as
 * páginas, mas apenas para as contagens, e não deve pagar estas chamadas. Se o motor
 * estiver desligado ou as salas não se lerem, devolve null e o texto mantém a regra
 * antiga dos pontos do Kixi, que é a correcta nesse caso.
 */
async function notasDoMotor(me: Me, sims: RawSimulation[]): Promise<NotasDoMotor> {
  if (!correcaoLigada()) return null;
  const corrigidas = sims.filter((s) => s.statement?.id != null && correctionNoticeOf(s));
  if (corrigidas.length === 0) return null;
  const salas = await listInvitations().catch(() => null);
  if (!salas?.ok) return null;

  const candidatas = corrigidas
    .filter((s) => eSimulacaoLivre(s.id, salas.data))
    .sort((a, b) =>
      (parseServerTime(b.correctedAt || b.finishedAt || '') || 0) - (parseServerTime(a.correctedAt || a.finishedAt || '') || 0));

  const grades = new Map<number, NotaMotor>();
  const livres = new Set(candidatas.map((s) => s.id));
  await Promise.all(candidatas.slice(0, MAX_NOTAS_MOTOR).map(async (s) => {
    const vista = await correcaoDaSimulacao({
      me,
      simulationId: s.id,
      statementId: Number(s.statement?.id),
    });
    if (vista?.kind === 'corrigida' && vista.resultado.nota != null) {
      grades.set(s.id, { score: vista.resultado.nota, scale: escalaDaNota(vista.resultado) });
    }
  }));
  return { grades, livres };
}

/**
 * As notificações do aluno, derivadas do que o backend já guarda: respostas às suas perguntas, medalhas, resultados e
 * correções prontas (kixi#793), cada uma com a sua data. Está por ler quando a data é posterior ao «marcar tudo como
 * lido». Uma fonte que falha fica de fora em vez de levar as outras.
 */
export const loadNotifications = cache(async (me: Me, withReplies = true, comNotasDoMotor = false): Promise<Notifications> => {
  const [readAt, badges, sims] = await Promise.all([
    readAtOf(),
    getBadges().catch(() => []),
    listSimulationsResult().then((r) => (r.ok ? r.data : [])),
  ]);
  const notas = comNotasDoMotor ? await notasDoMotor(me, sims) : null;
  const items: Omit<Notification, 'unread'>[] = [];

  for (const b of badges) {
    items.push({ key: `badge-${b.code}-${b.unlockedAt}`, kind: 'badge', who: null, text: `Desbloqueaste a medalha ${b.name}`, href: '/perfil', at: b.unlockedAt });
  }
  for (const s of sims) {
    // #793: quando a correção fica pronta, a notificação da entrega dá lugar à da
    // nota. A data passa a ser a da correção, por isso a mesma prova volta a contar
    // como nova para quem já tinha lido «Terminaste…».
    // `undefined`: sem motor, valem os pontos do Kixi. `null`: é uma simulação livre
    // com o motor ligado mas sem nota disponível — não se inventa um denominador.
    const grade = notas && notas.livres.has(s.id) ? (notas.grades.get(s.id) ?? null) : undefined;
    const corrigida = correctionNoticeOf({ ...s, grade });
    if (corrigida) {
      items.push({ ...corrigida, kind: 'correction', who: null });
      continue;
    }
    if (s.status === 'FINISHED' && s.finishedAt) {
      const title = s.statement?.title ?? 'a prova';
      // A nota só se diz quando é a do resultado; por corrigir — ou quando é o motor
      // que a tem (0–20, só no resultado) — diz-se o estado (#791/#820).
      const livre = notas?.livres.has(s.id) ?? false;
      const sufixo = sufixoDaNota({ ...s, notaDoMotor: livre });
      items.push({ key: `sim-${s.id}`, kind: 'result', who: null, text: `Terminaste ${title}${sufixo}`, href: `/resultado?prova=${s.id}`, at: s.finishedAt });
    }
  }

  // Respostas às minhas últimas perguntas.
  const classId = me.currentClass?.id;
  if (classId && withReplies) {
    const feed = await getFeed(classId, 1, 30);
    const mine = feed.ok ? feed.data.filter((p) => p.authorAccountId === me.accountId && p.commentCount > 0).slice(0, 5) : [];
    const threads = await Promise.all(mine.map(async (p) => ({ p, c: await getComments(p.id, 1, 20) })));
    for (const { p, c } of threads) {
      if (!c.ok) continue;
      for (const comment of c.data.filter((x) => !x.mine)) {
        const who = comment.displayName ?? 'Um colega';
        items.push({ key: `reply-${comment.id}`, kind: 'reply', who, text: `respondeu à tua pergunta «${(p.title || p.content).slice(0, 60)}»`, href: `/discussao/${p.id}`, at: comment.createdAt });
      }
    }
  }

  // Um só instante por item, lido com a convenção do servidor: serve para o por ler e para a ordem (as fontes
  // misturam datas com e sem fuso, e ordenar pelo texto trocava-as até uma hora).
  const stamped = items
    .map((i) => ({ ...i, ts: parseServerTime(i.at) || 0 }))
    .sort((a, b) => b.ts - a.ts)
    .map(({ ts, ...i }) => ({ ...i, unread: ts > readAt }));
  return {
    items: stamped,
    unreadCount: stamped.filter((i) => i.unread).length,
    unreadCorrections: stamped.filter((i) => i.unread && i.kind === 'correction').length,
  };
});
