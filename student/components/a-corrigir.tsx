'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingState } from '@/components/states';

/** O resultado de uma simulação ainda sem correcção: não há nota para mostrar. Volta a ler sozinho até estar corrigida. */
export function ACorrigir({ intervaloMs = 3000, desistirDepoisDeMs = 5 * 60_000 }: { intervaloMs?: number; desistirDepoisDeMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const inicio = Date.now();
    const id = setInterval(() => {
      if (Date.now() - inicio > desistirDepoisDeMs) clearInterval(id);
      else router.refresh();
    }, intervaloMs);
    return () => clearInterval(id);
  }, [router, intervaloMs, desistirDepoisDeMs]);
  return (
    <div className="grid gap-1">
      <LoadingState label="A corrigir a tua prova…" />
      <p className="text-center text-sm text-muted-foreground">
        A nota aparece aqui assim que a correcção terminar. Não precisas de recarregar a página.
      </p>
    </div>
  );
}
