import 'server-only';

import { cache } from 'react';
import { listInvitations } from './exam-room';
import type { Invitation } from './exam-room-rules';
import type { Result } from './api';
import { getCatalog, getCatalogNames, type CatalogItem } from './catalog';
import { listFriends, type Friend } from './friends';
import { getPerformance, type Performance } from './performance';
import { getLeaderboard, type RankingEntry } from './ranking';
import { getBadges, getStats, type Badge, type Stats } from './stats';
import type { Me } from './types';

/** Tudo o que as colunas sociais (cartão do aluno, amigos e widgets) mostram, lido do backend. */
export interface SocialData {
  stats: Stats | null;
  badges: Badge[];
  friends: Friend[];
  performance: Performance;
  /** As provas terminadas, com disciplina e nota (GET /statements/catalog + /simulations). */
  history: CatalogItem[];
  /** O topo da turma (GET /leaderboard?scope=class): já mascarado e decidido pelo backend. */
  classTop: RankingEntry[];
  /** As salas de prova do aluno tal como o backend as devolveu: o início mostra o erro, os widgets só as datas. */
  invitations: Result<Invitation[]>;
}

/**
 * Uma única leitura por pedido, partilhada pelo início e pelo perfil. Cada bloco que falha
 * fica vazio em vez de levar a página consigo: são painéis de apoio.
 */
export const loadSocial = cache(async (me: Me): Promise<SocialData> => {
  const classId = me.currentClass?.id ?? null;
  const [stats, badges, friends, performance, names, leaderboard, invitations] = await Promise.all([
    getStats(),
    getBadges(),
    listFriends(),
    getPerformance(),
    getCatalogNames(),
    classId ? getLeaderboard('class') : Promise.resolve(null),
    listInvitations(),
  ]);
  const catalog = await getCatalog({ size: 50 }, names);
  return {
    stats,
    badges,
    friends: friends.filter((f) => f.accepted),
    performance,
    history: catalog.ok ? catalog.items.filter((item) => item.state === 'done') : [],
    classTop: leaderboard?.ok ? leaderboard.data.entries.slice(0, 3) : [],
    invitations,
  };
});
