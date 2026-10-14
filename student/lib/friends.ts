import 'server-only';

import { apiDelete, apiGet, apiPost, type Result } from './api';

/** Um colega da turma que se pode convidar (GET /friends/search). O nome já vem mascarado. */
export interface Colleague {
  accountId: number;
  displayName: string;
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
}

const list = async <T>(path: string, query?: Record<string, string>): Promise<T[]> => {
  const result = await apiGet<T[]>(path, query);
  return result.ok && Array.isArray(result.data) ? result.data : [];
};

export const listFriends = () => list<Friend>('/friends');
export const listRequests = () => list<Friend>('/friends/requests');
export const searchColleagues = (q: string) => list<Colleague>('/friends/search', q ? { q } : undefined);

export const requestFriend = (accountId: number): Promise<Result<Friend>> =>
  apiPost<Friend>('/friends', { accountId });
export const acceptFriend = (friendshipId: number): Promise<Result<Friend>> =>
  apiPost<Friend>(`/friends/${friendshipId}/accept`, {});
export const removeFriend = (friendshipId: number): Promise<Result<void>> =>
  apiDelete<void>(`/friends/${friendshipId}`);
