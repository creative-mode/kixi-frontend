'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { montarTreinoAction } from '@/lib/exam-actions';

export interface TemaTreino {
  id: string;
  title: string;
  /** Quantas questões respondíveis o enunciado tem; limita as opções de «Questões». */
  total: number | null;
  estado: string;
}

const OPCOES = [5, 10, 20];

/** O ecrã «Treino de …» do protótipo: tema (um enunciado), número de questões e quando ver a correção. */
export function MontarTreino({ disciplina, temas, inicial }: { disciplina: string; temas: TemaTreino[]; inicial: string | null }) {
  const [state, action, pending] = useActionState(montarTreinoAction, undefined);
  const [tema, setTema] = useState(inicial ?? temas[0]?.id ?? '');
  const [n, setN] = useState(10);
  const [correcao, setCorrecao] = useState<'cada' | 'fim'>('cada');
  const escolhido = temas.find((t) => t.id === tema);

  const seg = 'flex h-12 flex-1 items-center justify-center rounded-xl border-[1.5px] text-[15px] font-bold cursor-pointer';
  return (
    <form
      action={action}
      onSubmit={() => { try { localStorage.setItem('kixi-treino-correcao', correcao); } catch { /* sem armazenamento, fica a correção a cada questão */ } }}
      className="flex min-w-0 flex-col px-4 pt-3 pb-28 md:px-0 md:pt-7 md:pb-12"
    >
      <header className="flex items-center gap-3.5 pb-6">
        <Link href="/provas" aria-label="Fechar" className="flex size-11 items-center justify-center rounded-xl text-[#121c15]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </Link>
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.02em]">Treino{disciplina ? ` de ${disciplina}` : ''}</h1>
      </header>

      <input type="hidden" name="statementId" value={tema} />
      <input type="hidden" name="questionCount" value={n} />

      <div className="flex flex-col gap-6">
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 text-sm font-bold text-[#3d4a41]">Tema</legend>
          {temas.length === 0 && <p className="text-sm text-[#617066]">Ainda não há provas para treinar.</p>}
          {temas.map((t, i) => (
            <label key={t.id} className="flex min-h-14 cursor-pointer items-center gap-3.5 border-[#eef0ec] py-2" style={{ borderTopWidth: i === 0 ? 0 : 1 }}>
              <input type="radio" name="tema" className="sr-only" checked={tema === t.id} onChange={() => setTema(t.id)} />
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 ${tema === t.id ? 'border-[#1f5a2c] bg-[#1f5a2c]' : 'border-[#cdd6c9] bg-white'}`}>
                {tema === t.id && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
              </span>
              <span className="flex-1 text-[15px]" style={tema === t.id ? { fontWeight: 600 } : undefined}>{t.title}</span>
              <span className="text-xs text-[#617066]">{t.estado}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="m-0 max-w-[360px] border-0 p-0">
          <legend className="mb-2 text-sm font-bold text-[#3d4a41]">Questões</legend>
          <div className="flex gap-2">
            {OPCOES.map((o) => (
              <button key={o} type="button" aria-pressed={n === o} onClick={() => setN(o)} className={`${seg} ${n === o ? 'border-[#1f5a2c] bg-[#f1f6ee] text-[#1f5a2c]' : 'border-[#dde3da] bg-white text-[#3d4a41]'}`}>{o}</button>
            ))}
          </div>
          {escolhido?.total != null && <p className="mt-2 text-[13px] text-[#617066]">Esta prova tem {escolhido.total} questões; se escolheres mais, fazes todas.</p>}
        </fieldset>

        <fieldset className="m-0 max-w-[360px] border-0 p-0">
          <legend className="mb-2 text-sm font-bold text-[#3d4a41]">Correção</legend>
          <div className="flex gap-2">
            {([['cada', 'A cada questão'], ['fim', 'Só no fim']] as const).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={correcao === v} onClick={() => setCorrecao(v)} className={`${seg} ${correcao === v ? 'border-[#1f5a2c] bg-[#f1f6ee] text-[#1f5a2c]' : 'border-[#dde3da] bg-white text-[#3d4a41]'}`}>{label}</button>
            ))}
          </div>
          <p className="mt-2 text-[13px] leading-[1.45] text-[#617066]">{correcao === 'cada' ? 'Vês logo se acertaste e porquê.' : 'Só vês a correção quando entregares o treino.'}</p>
        </fieldset>

        {state?.error && <p role="alert" className="text-sm font-semibold text-[#c2383e]">{state.error}</p>}
        <button type="submit" disabled={pending || !tema} className="h-[54px] w-full max-w-[360px] rounded-[14px] bg-[#1f5a2c] text-base font-bold text-white disabled:opacity-50">{pending ? 'A preparar…' : 'Começar o treino'}</button>
      </div>
    </form>
  );
}
