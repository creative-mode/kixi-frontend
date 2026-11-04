'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { track, type AnalyticsEvent, type AnalyticsParams } from '@/lib/analytics';

/**
 * Dispara um evento mínimo (kixi-frontend#219) quando a página chega com um parâmetro
 * de sucesso na barra de endereços — e só então: estes destinos (`/inicio`, `/aluno/prova/[id]`,
 * `/resultado`, ...) são revisitados muitas vezes por sessão, e o próprio ecrã não tem
 * nenhum outro sinal fiável de "isto acabou de acontecer agora", porque a navegação
 * vem de um `redirect()` de server action que não devolve um resultado ao cliente.
 *
 * O parâmetro é de uso único: dispara-se o evento e limpa-se a URL com `history.replaceState`
 * (sem nova entrada no histórico nem novo pedido ao servidor), para um refresh à mão não o repetir.
 */
export function FireEventOnce(props: { param: string; event: AnalyticsEvent; params?: AnalyticsParams }) {
  // `useSearchParams` opta a página fora da pré-renderização estática sem isto (o
  // Next exige um limite de Suspense); embrulhar aqui poupa cada ponto de chamada
  // de lembrar-se disso.
  return (
    <Suspense fallback={null}>
      <FireEventOnceInner {...props} />
    </Suspense>
  );
}

function FireEventOnceInner({ param, event, params }: { param: string; event: AnalyticsEvent; params?: AnalyticsParams }) {
  const searchParams = useSearchParams();
  const present = searchParams.has(param);

  useEffect(() => {
    if (!present) return;
    track(event, params);
    // Do endereço atual e não do `searchParams` do render: dois marcadores na mesma página não se repõem.
    const rest = new URLSearchParams(window.location.search);
    rest.delete(param);
    const query = rest.toString();
    // `history.replaceState` e não `router.replace`: o Next sincroniza o router com ele sem voltar a pedir a
    // página ao servidor. O `router.replace` refazia o pedido logo a seguir a chegar (um segundo render do
    // `/inicio` em cada login) e desmontava o que a pessoa estava a começar a usar.
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    // Só ao chegar com o parâmetro: não ao `pathname`/`searchParams` mudarem por o
    // próprio `replace` os limpar, ou isto disparava-se outra vez em loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present]);

  return null;
}
