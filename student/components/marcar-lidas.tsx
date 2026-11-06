'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { marcarNotificacoesLidasAction } from '@/lib/feed-actions';

export function MarcarLidas({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={disabled || pending} onClick={() => start(async () => { await marcarNotificacoesLidasAction(); router.refresh(); })} className="border-0 bg-transparent text-sm font-bold text-[#1f5a2c] disabled:opacity-40">
      Marcar tudo como lido
    </button>
  );
}
