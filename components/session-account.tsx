'use client';

import { createContext, useContext } from 'react';

/** O accountId da sessão, para os rascunhos de formulário nunca serem restaurados a outra pessoa. */
const SessionAccountContext = createContext<number | null>(null);

export function SessionAccountProvider({ accountId, children }: { accountId: number | null; children: React.ReactNode }) {
  return <SessionAccountContext.Provider value={accountId}>{children}</SessionAccountContext.Provider>;
}

export function useSessionAccount(): number | null {
  return useContext(SessionAccountContext);
}
