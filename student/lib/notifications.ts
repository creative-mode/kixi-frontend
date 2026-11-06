import 'server-only';

import { cache } from 'react';
import { apiGet } from './api';
import { getBadges } from './stats';
import { getFeed, getComments } from './feed';
import type { RawSimulation } from './performance-rules';
import type { Me } from './types';

export interface Notification {
  key: string;
  kind: 'reply' | 'badge' | 'result';
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
}

/** Até quando o aluno já viu as notificações; sem registo, nada foi lido. */
async function readAtOf(): Promise<number> {
  const r = await apiGet<{ readAt?: string }>('/me/notifications');
  const at = r.ok ? r.data?.readAt : undefined;
  return at ? Date.parse(at) || 0 : 0;
}

/**
 * As notificações do aluno, derivadas do que o backend já guarda: respostas às suas perguntas, medalhas e resultados,
 * cada uma com a sua data. Está por ler quando a data é posterior ao «marcar tudo como lido». Uma fonte que falha fica
 * de fora em vez de levar as outras.
 */
export const loadNotifications = cache(async (me: Me, withReplies = true): Promise<Notifications> => {
  const [readAt, badges, sims] = await Promise.all([
    readAtOf(),
    getBadges().catch(() => []),
    apiGet<RawSimulation[]>('/simulations').then((r) => (r.ok && Array.isArray(r.data) ? r.data : [])),
  ]);
  const items: Omit<Notification, 'unread'>[] = [];

  for (const b of badges) {
    items.push({ key: `badge-${b.code}-${b.unlockedAt}`, kind: 'badge', who: null, text: `Desbloqueaste a medalha ${b.name}`, href: '/perfil', at: b.unlockedAt });
  }
  for (const s of sims) {
    if (s.status === 'FINISHED' && s.finishedAt) {
      const title = s.statement?.title ?? 'a prova';
      const nota = s.finalScore != null ? ` com ${String(s.finalScore).replace('.', ',')}` : '';
      items.push({ key: `sim-${s.id}`, kind: 'result', who: null, text: `Terminaste ${title}${nota}`, href: `/resultado?prova=${s.id}`, at: s.finishedAt });
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

  const stamped = items
    .map((i) => ({ ...i, unread: (Date.parse(i.at.includes('Z') || /[+-]\d\d:?\d\d$/.test(i.at) ? i.at : `${i.at}+01:00`) || 0) > readAt }))
    .sort((a, b) => b.at.localeCompare(a.at));
  return { items: stamped, unreadCount: stamped.filter((i) => i.unread).length };
});
