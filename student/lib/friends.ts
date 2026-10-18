import 'server-only';

import { apiDelete, apiGet, apiPost, type Result } from './api';
import { loadPhotos } from './photos';

/** Um colega da turma que se pode convidar (GET /friends/search). O nome já vem mascarado. */
export interface Colleague {
  accountId: number;
  displayName: string;
  /** Vem do perfil, não da lista; null deixa as iniciais. */
  photo?: string | null;
}

/** Uma ligação (GET /friends e /friends/requests). `incoming` é um pedido que o aluno
 *  recebeu e pode aceitar; sem `accepted`, é um pedido ainda por responder. */
export interface Friend {
  friendshipId: number;
  accountId: number;
  displayName: string;
  status: string;
  accepted: boolean;
  incoming: boolean;
  photo?: string | null;
}

const list = async <T>(path: string, query?: Record<string, string>): Promise<T[]> => {
  const result = await apiGet<T[]>(path, query);
  return result.ok && Array.isArray(result.data) ? result.data : [];
};

/** A lista não traz foto: acrescenta-se a de cada conta, sem nunca falhar a lista por isso. */
async function withPhotos<T extends { accountId: number; photo?: string | null }>(rows: T[]): Promise<T[]> {
  const photos = await loadPhotos(rows.map((r) => r.accountId)).catch(() => ({}) as Record<number, string>);
  return rows.map((r) => ({ ...r, photo: photos[r.accountId] ?? null }));
}

export const listFriends = async () => withPhotos(await list<Friend>('/friends'));
export const listRequests = async () => withPhotos(await list<Friend>('/friends/requests'));
export const searchColleagues = async (q: string) => withPhotos(await list<Colleague>('/friends/search', q ? { q } : undefined));

export const requestFriend = (accountId: number): Promise<Result<Friend>> =>
  apiPost<Friend>('/friends', { accountId });
export const acceptFriend = (friendshipId: number): Promise<Result<Friend>> =>
  apiPost<Friend>(`/friends/${friendshipId}/accept`, {});
export const removeFriend = (friendshipId: number): Promise<Result<void>> =>
  apiDelete<void>(`/friends/${friendshipId}`);
