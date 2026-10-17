'use client';

import { reopenConsent } from '@/lib/consent';

/** Ligação do rodapé que volta a perguntar. */
export function CookieSettings({ className }: { className?: string }) {
  return <button type="button" className={className} onClick={reopenConsent}>Preferências de cookies</button>;
}
