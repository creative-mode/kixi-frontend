'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { registarEventoAction } from '@/lib/exam-actions';
import { noticeFor, shouldRecord, type IntegrityEvent, type IntegrityKind } from '@/lib/integrity';

/**
 * O modo de avaliação do lado do browser (#192): ouve o que o browser consegue
 * ver — separador escondido, janela sem foco, e o regresso — e regista-o, sem
 * travar a prova.
 *
 * Os eventos vão por uma server action, um a um, à medida que acontecem: o
 * momento interessa (é o que o professor lê), e agrupá-los num lote perderia a
 * hora de cada um. A falha é silenciosa de propósito — o registo é uma nota para
 * o professor, não uma condição para responder. Um aluno com a rede a falhar não
 * pode deixar de fazer a prova por o evento não ter chegado.
 *
 * O aviso é o único sítio onde isto toca o ecrã: nada aqui bloqueia o aluno.
 */
export function useIntegrity({
  simulationId,
  active,
}: {
  simulationId: number;
  /** Falso quando a tentativa fechou: os ouvintes ficam, mas nada se regista. */
  active: boolean;
}): { notice: string | null; dismiss: () => void; record: (kind: IntegrityKind, questionId?: number | null) => void } {
  const [notice, setNotice] = useState<string | null>(null);
  // O que já se registou, só para o `shouldRecord` engolir sinais equivalentes.
  const recorded = useRef<IntegrityEvent[]>([]);
  // Em `ref` para o ouvinte não ter de se voltar a ligar quando a tentativa fecha.
  const activeRef = useRef(active);
  activeRef.current = active;

  const record = useCallback(
    (kind: IntegrityKind, questionId: number | null = null) => {
      if (!activeRef.current) return;
      const at = Date.now();
      if (!shouldRecord(recorded.current, kind, at)) return;
      recorded.current = [...recorded.current, { kind, at, questionId }];
      const message = noticeFor(kind);
      if (message) setNotice(message);
      void registarEventoAction({ simulationId, kind, questionId });
    },
    [simulationId],
  );

  useEffect(() => {
    // `hidden` e `blur` são a mesma saída, e o regresso também se repete em
    // `visible` e `focus`: quem engole o par é o `shouldRecord`, não o ouvinte.
    const onVisibility = () => record(document.hidden ? 'TAB_HIDDEN' : 'TAB_VISIBLE');
    const onBlur = () => record('WINDOW_BLUR');
    const onFocus = () => record('WINDOW_FOCUS');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [record]);

  return { notice, dismiss: useCallback(() => setNotice(null), []), record };
}
