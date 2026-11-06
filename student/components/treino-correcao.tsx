'use client';

import { useState, useTransition } from 'react';
import { verificarAction } from '@/lib/exam-actions';

/**
 * Treino: «Ver se acertei». Só aparece numa simulação livre (nunca numa sala de prova). O servidor decide: numa sala
 * responde 403 e o aluno vê que a prova não mostra a correção. Remonta-se quando a opção muda (`key` no pai).
 */
export function TreinoCorrecao({ simulationId, questionId, optionId, onNext, hasNext }: { simulationId: number; questionId: number; optionId: number | null; onNext: () => void; hasNext: boolean }) {
  const [pending, start] = useTransition();
  // «Só no fim» (escolhido ao montar o treino): a correção fica para o resultado.
  const [soNoFim] = useState(() => { try { return localStorage.getItem('kixi-treino-correcao') === 'fim'; } catch { return false; } });
  const [result, setResult] = useState<{ correct: boolean | null; explanation: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = () => start(async () => {
    setError(null);
    const r = await verificarAction(simulationId, questionId, optionId);
    if (!r.ok) { setError(r.message); return; }
    setResult({ correct: r.correct, explanation: r.explanation });
  });

  if (soNoFim) return null;
  if (!result) {
    return (
      <div className="grid gap-2">
        <button type="button" onClick={check} disabled={pending || optionId === null} className="h-12 self-start rounded-xl border-[1.5px] border-[#dde3da] bg-white px-5 text-[15px] font-bold disabled:opacity-50">{pending ? 'A verificar…' : 'Ver se acertei'}</button>
        {error && <p role="alert" className="text-sm font-semibold text-[#c2383e]">{error}</p>}
      </div>
    );
  }
  const certo = result.correct === true;
  return (
    <div role="status" className="grid gap-3 rounded-[20px] p-5" style={{ background: certo ? '#eef6ea' : '#fdf1f1' }}>
      <strong className="flex items-center gap-2 text-base" style={{ color: certo ? '#1b4d27' : '#a52a2f' }}>
        {certo ? 'Certo. Estás a apanhar o jeito.' : 'Ainda não.'}
      </strong>
      {result.explanation && <p className="m-0 text-[15px] leading-[1.5]">{result.explanation}</p>}
      <div className="flex flex-wrap gap-2.5">
        <a href={`/aluno/tutor`} className="flex h-12 items-center rounded-xl border-[1.5px] border-[#dde3da] bg-white px-5 text-[15px] font-bold text-[#121c15] no-underline">{certo ? 'Perguntar ao tutor' : 'Explicar melhor'}</a>
        {hasNext && <button type="button" onClick={onNext} className="h-12 flex-1 rounded-xl bg-[#1f5a2c] px-5 text-[15px] font-bold text-white">Seguinte</button>}
      </div>
    </div>
  );
}
