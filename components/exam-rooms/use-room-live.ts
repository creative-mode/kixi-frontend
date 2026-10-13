'use client';

import { useEffect, useRef, useState } from 'react';
import { BASE_PATH } from '@/lib/constants';
import type { LiveSnapshot } from '@/lib/exam-rooms/model';

export type LiveState = {
  snapshot: LiveSnapshot | null;
  /** Segundos que faltam, a descer no browser entre eventos. */
  remaining: number | null;
  connection: 'idle' | 'connecting' | 'live' | 'retrying';
};

/**
 * O progresso da sala, pelo SSE do backend (`/exam-rooms/{id}/live`, via a rota
 * `app/api/exam-rooms/[id]/live`). O backend manda um evento a cada 2 s e fecha
 * quando a sala encerra; o `EventSource` volta a ligar sozinho se a ligação cair.
 *
 * Entre eventos, o tempo restante desce no browser a partir do `remainingSeconds`
 * do servidor, e não do relógio do browser: um computador com a hora errada não
 * pode mostrar ao professor um tempo que não é o da prova.
 */
export function useRoomLive(roomId: number, enabled: boolean): LiveState {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [connection, setConnection] = useState<Exclude<LiveState['connection'], 'idle'>>('connecting');
  const receivedAt = useRef<{ at: number; seconds: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const source = new EventSource(`${BASE_PATH}/api/exam-rooms/${roomId}/live`);
    source.addEventListener('progress', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent<string>).data) as LiveSnapshot;
        receivedAt.current = { at: Date.now(), seconds: data.remainingSeconds };
        setSnapshot(data);
        setRemaining(data.remainingSeconds);
        setConnection('live');
        // A sala fechou: o backend acaba o stream, e voltar a ligar só repetia o último evento.
        if (data.status === 'CLOSED') source.close();
      } catch {
        // Um evento que não se lê não deve derrubar o painel; o seguinte chega em 2 s.
      }
    });
    source.onerror = () => {
      if (source.readyState !== EventSource.CLOSED) setConnection('retrying');
    };
    return () => source.close();
  }, [roomId, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const tick = window.setInterval(() => {
      const r = receivedAt.current;
      if (!r) return;
      setRemaining(Math.max(0, r.seconds - Math.floor((Date.now() - r.at) / 1000)));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [enabled]);

  return { snapshot, remaining, connection: enabled ? connection : 'idle' };
}
