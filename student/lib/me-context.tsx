'use client';

import { createContext, useContext } from 'react';
import type { Me } from './types';

/** The student's profile for client components.
 *
 *  The layout already fetches /me once per request, so this publishes that result
 *  instead of letting each screen call the API again — there is a single source of
 *  truth for the name and class, and editing the profile updates every screen. */
const MeContext = createContext<Me | null>(null);

export function MeProvider({ me, children }: { me: Me | null; children: React.ReactNode }) {
  return <MeContext value={me}>{children}</MeContext>;
}

export function useMe(): Me | null {
  return useContext(MeContext);
}
