'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { track } from '@/lib/analytics';

/**
 * Dispara um evento mínimo (kixi-frontend#219) quando a página chega com um parâmetro
 * de sucesso na barra de endereços — e só então: estes destinos (`/inicio`, `/aluno/prova/[id]`,
 * `/resultado`, ...) são revisitados muitas vezes por sessão, e o próprio ecrã não tem
 * nenhum outro sinal fiável de "isto acabou de acontecer agora", porque a navegação
 * vem de um `redirect()` de server action que não devolve um resultado ao cliente.
 *
 * O parâmetro é de uso único: dispara-se o evento e limpa-se a URL com `replace` (sem
 * nova entrada no histórico), para um refresh à mão não o repetir.
 */
export function FireEventOnce(props: { param: string; event: string }) {
  // `useSearchParams` opta a página fora da pré-renderização estática sem isto (o
  // Next exige um limite de Suspense); embrulhar aqui poupa cada ponto de chamada
  // de lembrar-se disso.
  return (
    <Suspense fallback={null}>
      <FireEventOnceInner {...props} />
    </Suspense>
  );
}

function FireEventOnceInner({ param, event }: { param: string; event: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const present = searchParams.has(param);

  useEffect(() => {
    if (!present) return;
    track(event);
    const rest = new URLSearchParams(searchParams);
    rest.delete(param);
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    // Só ao chegar com o parâmetro: não ao `pathname`/`searchParams` mudarem por o
    // próprio `replace` os limpar, ou isto disparava-se outra vez em loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present]);

  return null;
}
