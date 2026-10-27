'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingState } from '@/components/states';

/** O resultado de uma simulação ainda sem correcção: não há nota para mostrar. Volta a ler sozinho até estar corrigida. */
export function ACorrigir({ intervaloMs = 3000, desistirDepoisDeMs = 5 * 60_000 }: { intervaloMs?: number; desistirDepoisDeMs?: number }) {
  const router = useRouter();
  const [demora, setDemora] = useState(false);
  useEffect(() => {
    const inicio = Date.now();
    const id = setInterval(() => {
      if (Date.now() - inicio > desistirDepoisDeMs) {
        clearInterval(id);
        setDemora(true);
      } else router.refresh();
    }, intervaloMs);
    return () => clearInterval(id);
  }, [router, intervaloMs, desistirDepoisDeMs]);
  if (demora) {
    return <p role="status" className="text-center text-sm">A correcção está a demorar mais do que o esperado. A tua prova está guardada: volta a abrir o resultado daqui a pouco.</p>;
  }
  return (
    <div className="grid gap-1">
      <LoadingState label="A corrigir a tua prova…" />
      <p className="text-center text-sm text-muted-foreground">
        A nota aparece aqui assim que a correcção terminar. Não precisas de recarregar a página.
      </p>
    </div>
  );
}
