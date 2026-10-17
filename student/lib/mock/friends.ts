// As amizades do mock (kixi#121): as regras do FriendshipService, à parte do backend.ts para se testarem.

export type Friendship = { id: number; requesterId: number; addresseeId: number; accepted: boolean };

export type FriendView = {
  friendshipId: number;
  accountId: number;
  displayName: string;
  status: 'PENDING' | 'ACCEPTED';
  accepted: boolean;
  incoming: boolean;
};

export type Outcome<T> = { ok: true; value: T } | { ok: false; status: number; message: string };

const other = (row: Friendship, me: number) => (row.requesterId === me ? row.addresseeId : row.requesterId);
const mine = (row: Friendship, me: number) => row.requesterId === me || row.addresseeId === me;

export function viewOf(row: Friendship, me: number, nameOf: (id: number) => string): FriendView {
  const id = other(row, me);
  return {
    friendshipId: row.id,
    accountId: id,
    displayName: nameOf(id),
    status: row.accepted ? 'ACCEPTED' : 'PENDING',
    accepted: row.accepted,
    incoming: !row.accepted && row.addresseeId === me,
  };
}

/** Quem o ranking de amigos conta: só as ligações aceites. */
export const friendIds = (rows: Friendship[], me: number): number[] =>
  rows.filter((r) => r.accepted && mine(r, me)).map((r) => other(r, me));

export const listFriends = (rows: Friendship[], me: number, nameOf: (id: number) => string) =>
  rows.filter((r) => r.accepted && mine(r, me)).map((r) => viewOf(r, me, nameOf));

/** A caixa de entrada: pedidos por responder, recebidos e enviados. */
export const listRequests = (rows: Friendship[], me: number, nameOf: (id: number) => string) =>
  rows.filter((r) => !r.accepted && mine(r, me)).map((r) => viewOf(r, me, nameOf));

/** Colegas que se podem convidar: do mesmo ano letivo, sem ligação nenhuma ainda, filtrados pelo nome. */
export function searchable(
  rows: Friendship[],
  me: number,
  colleagues: { id: number; name: string }[],
  q: string,
): { accountId: number; displayName: string }[] {
  const term = q.trim().toLowerCase();
  const related = new Set(rows.filter((r) => mine(r, me)).map((r) => other(r, me)));
  return colleagues
    .filter((c) => c.id !== me && !related.has(c.id) && (!term || c.name.toLowerCase().includes(term)))
    .map((c) => ({ accountId: c.id, displayName: c.name }));
}

export function request(rows: Friendship[], me: number, target: unknown, nextId: number): Outcome<Friendship> {
  if (typeof target !== 'number' || !Number.isInteger(target)) return { ok: false, status: 400, message: 'An account is required to follow someone' };
  if (target === me) return { ok: false, status: 400, message: 'You cannot follow yourself' };
  if (rows.some((r) => mine(r, me) && other(r, me) === target)) return { ok: false, status: 409, message: 'You already follow this colleague, or a request is pending' };
  return { ok: true, value: { id: nextId, requesterId: me, addresseeId: target, accepted: false } };
}

/** Só quem recebeu o pedido o aceita; para os outros ele "não existe". */
export function accept(rows: Friendship[], me: number, id: number): Outcome<Friendship> {
  const row = rows.find((r) => r.id === id && r.addresseeId === me && !r.accepted);
  return row ? { ok: true, value: row } : { ok: false, status: 404, message: `Friend request not found: ${id}` };
}

export function remove(rows: Friendship[], me: number, id: number): Outcome<Friendship> {
  const row = rows.find((r) => r.id === id && mine(r, me));
  return row ? { ok: true, value: row } : { ok: false, status: 404, message: `Friendship not found: ${id}` };
}
