import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { canAccessManager, normalizeRoles } from '@/lib/roles';
import { COOKIE, decode, managerUrl } from '@/lib/session';
import { Shell } from '@/components/Shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
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
    redirect('/403?reason=role');
  }

  return <Shell>{children}</Shell>;
}
