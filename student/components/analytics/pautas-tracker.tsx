'use client';

import { useEffect, useRef } from 'react';
import { pautasSeconds, track } from '@/lib/analytics';

/**
 * #802: quanto tempo o aluno ficou nas Pautas. Conta só o tempo em que o ecrã esteve visível,
 * fecha ao sair da rota ou ao fechar a página e envia no máximo um `pautas_tempo` por visita.
 * Sem consentimento o `track` devolve `denied` e nada sai; o relógio não guarda nada fora da memória.
 */
export function PautasTracker() {
  const started = useRef<number | null>(null);
  const accumulated = useRef(0);
  const sent = useRef(false);

  useEffect(() => {
    let closeTimer: ReturnType<typeof setTimeout> | undefined;

    const open = () => {
      // No Strict Mode a montagem repete-se: o fecho da primeira é cancelado aqui, sem evento.
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = undefined;
      }
      if (started.current === null) started.current = performance.now();
    };
    const pause = () => {
      if (started.current === null) return;
      accumulated.current += performance.now() - started.current;
      started.current = null;
    };
    const finish = () => {
      if (sent.current) return;
      pause();
      sent.current = true;
      track('pautas_tempo', { segundos: pautasSeconds(accumulated.current / 1000) });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') pause();
      else open();
    };

    open();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', finish);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', finish);
      pause();
      // Na desmontagem real fecha e envia; no Strict Mode o `open()` seguinte cancela este timer.
      closeTimer = setTimeout(finish, 0);
    };
  }, []);

  return null;
}
