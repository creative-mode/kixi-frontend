import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { canAccessManager, normalizeRoles } from './roles';
import { COOKIE, decode, managerUrl, type Session } from './session';

/** The gate every private screen in this app shares: there must be a live session and
 *  it must be a student's. Administrators and teachers are bounced to the manager,
 *  anyone else lands on 403.
 *
 *  Kept out of the route layouts because /onboarding needs the same rules without the
 *  enrollment check — a student who has not enrolled yet still has to reach it. */
export async function requireStudent(): Promise<Session> {
  const token = (await cookies()).get(COOKIE)?.value;
  const session = decode(token);

  if (!session) {
    redirect(`/entrar?reason=${token ? 'session-expired' : 'required'}`);
  }

  const roles = normalizeRoles(session.roles);
  if (canAccessManager(roles)) {
    redirect(await managerUrl());
  }
  if (roles.length !== 1 || !roles.includes('STUDENT')) {
    redirect('/403');
  }

  return session;
}
