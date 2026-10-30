import 'server-only';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { canAccessManager, normalizeRoles } from './roles';
import { verificarSessao, type Session } from './jwt';
import { COOKIE, managerUrl } from './session';
import { studentNext } from './safe-next';

/** O endereço do login desta app, com o destino de regresso quando o proxy o deixou escrito. */
export async function entrarUrl(reason: 'required' | 'session-expired'): Promise<string> {
  const params = new URLSearchParams({ reason });
  const next = studentNext((await headers()).get('x-pathname'));
  if (next) params.set('next', next);
  return `/entrar?${params.toString()}`;
}

/** The gate every private screen in this app shares: there must be a live session and
 *  it must be a student's. Administrators and teachers are bounced to the manager,
 *  anyone else lands on 403.
 *
 *  Kept out of the route layouts because /onboarding needs the same rules without the
 *  enrollment check — a student who has not enrolled yet still has to reach it. */
export async function requireStudent(): Promise<Session> {
  const token = (await cookies()).get(COOKIE)?.value;
  const session = await verificarSessao(token);

  if (!session) {
    redirect(await entrarUrl(token ? 'session-expired' : 'required'));
  }

  const roles = normalizeRoles(session.roles);
  if (canAccessManager(roles)) {
    redirect(await managerUrl());
  }
  if (roles.length !== 1 || !roles.includes('STUDENT')) {
    redirect('/403?reason=role');
  }

  return session;
}
