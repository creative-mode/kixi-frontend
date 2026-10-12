import 'server-only';

import { apiGet } from './api';

/** GET /me/stats (UserStatsResponse). XP, nível e streak são derivados aqui a
 *  partir dos campos que o backend já calcula — nada disto é recalculado no
 *  cliente, só formatado. */
export interface Stats {
  accountId: number;
  xp: number;
  level: number;
  streak: number;
  longestStreak: number;
  freePauses: number;
  lastActivityDate: string | null;
}

/** Uma medalha do aluno, GET /me/badges (UserBadgeResponse[]). */
export interface Badge {
  code: string;
  name: string;
  description: string;
  subjectId: number | null;
  unlockedAt: string;
}

export async function getStats(): Promise<Stats | null> {
  const result = await apiGet<Stats>('/me/stats');
  return result.ok ? result.data : null;
}

export async function getBadges(): Promise<Badge[]> {
  const result = await apiGet<Badge[]>('/me/badges');
  return result.ok && Array.isArray(result.data) ? result.data : [];
}
