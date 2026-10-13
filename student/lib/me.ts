import 'server-only';

import { cache } from 'react';
import { apiGet } from './api';
import type { Me } from './types';

export type Profile =
  | { kind: 'ok'; me: Me }
  /** The backend could not be reached, or answered with something that is not about
   *  the session. Screens degrade rather than block: a hiccup must not lock a student
   *  out of their feed. */
  | { kind: 'unknown'; me: null }
  /** The token is missing, expired or rejected. Nothing downstream can work, so the
   *  session has to be renewed. */
  | { kind: 'unauthorized'; me: null };

/** The signed-in student's profile, fetched at most once per request. */
export const getProfile = cache(async (): Promise<Profile> => {
  const result = await apiGet<Me>('/me');
  if (result.ok) return { kind: 'ok', me: result.data };
  return result.status === 401 ? { kind: 'unauthorized', me: null } : { kind: 'unknown', me: null };
});

/** Just the profile, for screens that treat an unavailable one as empty. */
export async function getMe(): Promise<Me | null> {
  return (await getProfile()).me;
}
