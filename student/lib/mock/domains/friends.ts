import * as friends from '../friends';

import { json, maskedName, problem } from '../store';
import type { MockCtx } from '../store';

/** Rotas do domínio «friends» do mock; devolve `undefined` quando o pedido não é deste domínio. */
export async function friendsRoutes({ method, pathname, search, filter, body, text, accountId, account, staff, db }: MockCtx): Promise<Response | undefined> {
  void [method, pathname, search, filter, body, text, accountId, account, staff, db];
  // ── amizades (kixi#121): o FriendshipService, com as regras em ./friends ──────
  if (pathname.startsWith('/friends') && accountId !== null) {
    const me = accountId;
    const nameOf = (id: number) => maskedName(db, id) ?? 'Aluno';
    if (pathname === '/friends' && method === 'GET') return json(friends.listFriends(db.friendships, me, nameOf));
    if (pathname === '/friends/requests' && method === 'GET') return json(friends.listRequests(db.friendships, me, nameOf));
    if (pathname === '/friends/search' && method === 'GET') {
      const mineEnrollment = db.enrollments.find((e) => e.accountId === me && e.status === 'ACTIVE');
      if (!mineEnrollment) return problem(409, 'An active enrollment in a school is needed to search colleagues');
      const colleagues = db.enrollments
        .filter((e) => e.status === 'ACTIVE' && e.schoolYearId === mineEnrollment.schoolYearId)
        .map((e) => ({ id: e.accountId, name: nameOf(e.accountId) }));
      return json(friends.searchable(db.friendships, me, colleagues, search.get('q') ?? ''));
    }
    if (pathname === '/friends' && method === 'POST') {
      const made = friends.request(db.friendships, me, body.accountId, db.nextFriendship);
      if (!made.ok) return problem(made.status, made.message);
      const target = Number(body.accountId);
      const mineEnrollment = db.enrollments.find((e) => e.accountId === me && e.status === 'ACTIVE');
      const same = db.enrollments.some((e) => e.accountId === target && e.status === 'ACTIVE' && e.schoolYearId === mineEnrollment?.schoolYearId);
      if (!same) return problem(400, 'That colleague is not in your school this year');
      db.nextFriendship += 1;
      db.friendships.push(made.value);
      return json(friends.viewOf(made.value, me, nameOf), 201);
    }
    const act = pathname.match(/^\/friends\/(\d+)(\/accept)?$/);
    if (act && act[2] && method === 'POST') {
      const done = friends.accept(db.friendships, me, Number(act[1]));
      if (!done.ok) return problem(done.status, done.message);
      done.value.accepted = true;
      return json(friends.viewOf(done.value, me, nameOf));
    }
    if (act && !act[2] && method === 'DELETE') {
      const done = friends.remove(db.friendships, me, Number(act[1]));
      if (!done.ok) return problem(done.status, done.message);
      db.friendships = db.friendships.filter((r) => r.id !== done.value.id);
      return new Response(null, { status: 204 });
    }
  }

  return undefined;
}
