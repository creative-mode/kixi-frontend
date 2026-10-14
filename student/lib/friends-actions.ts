'use server';

import {
  acceptFriend,
  listFriends,
  listRequests,
  removeFriend,
  requestFriend,
  searchColleagues,
  type Colleague,
  type Friend,
} from './friends';

export type Connections = { friends: Friend[]; requests: Friend[] };
type Done = { ok: true } | { ok: false; message: string };

/** Amigos e pedidos pendentes, para o painel do ranking. */
export async function loadConnectionsAction(): Promise<Connections> {
  const [friends, requests] = await Promise.all([listFriends(), listRequests()]);
  return { friends, requests };
}

export async function searchColleaguesAction(q: string): Promise<Colleague[]> {
  return searchColleagues(q.trim());
}

export async function requestFriendAction(accountId: number): Promise<Done> {
  const result = await requestFriend(accountId);
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}

export async function acceptFriendAction(friendshipId: number): Promise<Done> {
  const result = await acceptFriend(friendshipId);
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}

export async function removeFriendAction(friendshipId: number): Promise<Done> {
  const result = await removeFriend(friendshipId);
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}
