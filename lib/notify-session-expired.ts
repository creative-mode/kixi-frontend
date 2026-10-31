'use client';

import { toast } from 'sonner';
import { MANAGER_BASE_PATH, managerNext } from './safe-next';
import { isSessionExpiredError } from './session-errors';

/**
 * Aviso persistente de sessão expirada (#503).
 *
 * O trabalho do formulário não se perde: fica em `sessionStorage` (lib/form-drafts.ts)
 * neste separador. O login abre numa aba nova para a pessoa poder voltar a este
 * separador e continuar depois de autenticar; o cookie é partilhado, por isso a aba
 * original passa a ter sessão sem recarregar o formulário.
 */
export function notifySessionExpired(): void {
  if (typeof window === 'undefined') return;

  const here = managerNext(`${window.location.pathname}${window.location.search}`) ?? `${MANAGER_BASE_PATH}/`;
  const login = new URL(`${MANAGER_BASE_PATH}/login`, window.location.origin);
  login.searchParams.set('next', here);

  toast.error('A tua sessão expirou', {
    id: 'kixi-sessao-expirada',
    description: 'Inicia sessão numa aba nova para continuares. O que tens neste separador fica guardado.',
    duration: Infinity,
    closeButton: true,
    action: {
      label: 'Iniciar sessão',
      onClick: () => window.open(login.toString(), '_blank', 'noopener,noreferrer'),
    },
  });
}

/** Mostra o erro habitual ou, se for de sessão, o aviso persistente com a ação de entrar. */
export function reportActionError(message: string | null | undefined, code?: unknown): void {
  if (isSessionExpiredError(message, code)) notifySessionExpired();
  else if (message) toast.error(message);
}
