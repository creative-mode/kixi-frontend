'use client';

import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';
import { simularProvaAction } from '@/lib/exam-actions';
import { wallClockOf } from '@/lib/home-rules';
import { clampCount, levelLabel, masteryOf, picksOf, presetCounts, sourcesLabel, summarize, valuesLabel, type Preset, type TrainingPlan } from '@/lib/training';

const PRESETS: { id: Preset; label: string; hint: string }[] = [
  { id: 'prova', label: 'Como na prova', hint: 'As mesmas quantidades da matriz do professor.' },
  { id: 'dobro', label: 'O dobro', hint: 'Duas vezes as questões de cada tema, para ganhar margem.' },
  { id: 'fracos', label: 'Reforçar o que falho', hint: 'Mais questões nos temas em que ainda erras ou nunca treinaste.' },
];

const seg = 'flex min-h-11 flex-1 items-center justify-center rounded-xl border-[1.5px] px-3 text-center text-[14px] font-bold leading-tight cursor-pointer';

/**
 * «Prepara-te para a prova»: a matriz que o professor carregou (temas, questões e cotação de cada um) e, por tema,
 * quantas questões queres treinar. «Simular a prova» monta uma prova só com essas questões, vindas de provas de
 * anos anteriores, no mesmo tempo proporcional ao da prova à séria.
 */
export function PrepararProva({ plan }: { plan: TrainingPlan }) {
  const [state, action, pending] = useActionState(simularProvaAction, undefined);
  const [counts, setCounts] = useState<Record<number, number>>(() => presetCounts(plan.items, 'prova'));
  const [preset, setPreset] = useState<Preset | null>('prova');
  const [correcao, setCorrecao] = useState<'cada' | 'fim'>('cada');
  const summary = useMemo(() => summarize(plan, counts), [plan, counts]);
  const picks = useMemo(() => picksOf(plan, counts), [plan, counts]);
  const when = wallClockOf(plan.startsAt);
  const examQuestions = plan.items.reduce((n, i) => n + i.questionCount, 0);

  const choose = (next: Preset) => { setPreset(next); setCounts(presetCounts(plan.items, next)); };
  const step = (topicId: number, delta: number) => {
    const item = plan.items.find((i) => i.topicId === topicId);
    if (!item) return;
    setPreset(null);
    setCounts((c) => ({ ...c, [topicId]: clampCount((c[topicId] ?? 0) + delta, item) }));
  };

  return (
    <form
      action={action}
      onSubmit={() => { try { localStorage.setItem('kixi-treino-correcao', correcao); } catch { /* sem armazenamento, fica a correção a cada questão */ } }}
      className="flex min-w-0 flex-col px-4 pt-3 pb-52 md:px-0 md:pt-7 md:pb-28"
    >
      <input type="hidden" name="roomId" value={plan.roomId} />
      <input type="hidden" name="items" value={JSON.stringify(picks)} />
      {summary.minutes != null && <input type="hidden" name="durationMinutes" value={summary.minutes} />}

      <Link href="/provas" className="mb-4 inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-[#617066] no-underline">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
        Provas
      </Link>

      <header className="rounded-[20px] border border-[#e4e7e1] bg-[#f1f6ee] p-5">
        <p className="m-0 text-xs font-bold tracking-[0.06em] text-[#1f5a2c] uppercase">Prova agendada · {when.day} {when.month}, {when.time}</p>
        <h1 className="m-0 mt-1.5 text-[26px] leading-tight font-extrabold tracking-[-0.02em]">{plan.statementTitle ?? 'Prova'}</h1>
        {plan.subjectName && <p className="m-0 mt-1 text-[15px] text-[#3d4a41]">{plan.subjectName}</p>}
        <ul aria-label="A prova em números" className="m-0 mt-4 flex list-none flex-wrap gap-2 p-0">
          {[
            plan.durationMinutes ? `${plan.durationMinutes} min` : null,
            `${plan.totalPoints} valores`,
            `${plan.items.length} ${plan.items.length === 1 ? 'tema' : 'temas'}`,
            `${examQuestions} questões`,
          ].filter((x): x is string => !!x).map((x) => (
            <li key={x} className="rounded-full bg-white px-3 py-1 text-[13px] font-bold text-[#1f5a2c]">{x}</li>
          ))}
        </ul>
      </header>

      <h2 className="m-0 mt-8 text-lg font-extrabold">O que sai na prova</h2>
      <p className="m-0 mt-1 text-sm text-[#617066]">Escolhe quantas questões queres treinar por tema. Vêm de provas de anos anteriores, nunca desta.</p>

      <div role="group" aria-label="Ponto de partida" className="mt-4 flex gap-2">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" aria-pressed={preset === p.id} title={p.hint} onClick={() => choose(p.id)} className={`${seg} ${preset === p.id ? 'border-[#1f5a2c] bg-[#f1f6ee] text-[#1f5a2c]' : 'border-[#dde3da] bg-white text-[#3d4a41]'}`}>{p.label}</button>
        ))}
      </div>

      <ul className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
        {plan.items.map((item) => {
          const n = clampCount(counts[item.topicId] ?? 0, item);
          const { pct, weak } = masteryOf(item);
          const level = levelLabel(item.cognitiveLevel);
          const points = valuesLabel(item.points);
          return (
            <li key={item.topicId} className="rounded-[20px] border border-[#e4e7e1] bg-white p-4 md:p-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="m-0 text-[17px] leading-snug font-bold">{item.name}</h3>
                  <p className="m-0 mt-1 text-[13px] text-[#617066]">
                    Na prova: {item.questionCount} {item.questionCount === 1 ? 'questão' : 'questões'}{points ? ` · ${points}` : ''}{level ? ` · ${level}` : ''}
                  </p>
                </div>
                <div role="group" aria-label={`Questões de ${item.name}`} className="flex shrink-0 items-center gap-1 rounded-full bg-[#f5f6f4] p-1">
                  <button type="button" aria-label={`Menos questões de ${item.name}`} disabled={n <= 0} onClick={() => step(item.topicId, -1)} className="grid size-11 place-items-center rounded-full border-0 bg-white text-xl font-bold text-[#1f5a2c] disabled:text-[#b4bdb6]">&minus;</button>
                  <output aria-live="polite" className="w-8 text-center text-[17px] font-extrabold tabular-nums">{n}</output>
                  <button type="button" aria-label={`Mais questões de ${item.name}`} disabled={n >= item.available} onClick={() => step(item.topicId, 1)} className="grid size-11 place-items-center rounded-full border-0 bg-white text-xl font-bold text-[#1f5a2c] disabled:text-[#b4bdb6]">+</button>
                </div>
              </div>

              <div className="mt-3.5 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef0ec]" role="img" aria-label={pct == null ? 'Ainda não treinaste este tema' : `Acertas ${pct}% neste tema`}>
                  <div className={`h-full rounded-full ${weak ? 'bg-[#c2383e]' : 'bg-[#1f5a2c]'}`} style={{ width: `${pct ?? 0}%` }} />
                </div>
                <span className={`text-[13px] ${weak && pct != null ? 'font-semibold text-[#c2383e]' : 'text-[#617066]'}`}>
                  {pct == null ? 'Ainda não treinaste' : `Acertaste ${item.correct} de ${item.attempted}`}
                </span>
              </div>
              <p className="m-0 mt-2 text-[13px] text-[#617066]">{sourcesLabel(item)}</p>
              {item.available < item.questionCount && (
                <p className="m-0 mt-1.5 text-[13px] font-semibold text-[#8a5a00]">Só há {item.available} {item.available === 1 ? 'questão' : 'questões'}; a prova pede {item.questionCount}.</p>
              )}
            </li>
          );
        })}
      </ul>

      <fieldset className="m-0 mt-6 max-w-[420px] border-0 p-0">
        <legend className="mb-2 text-sm font-bold text-[#3d4a41]">Correção</legend>
        <div className="flex gap-2">
          {([['cada', 'A cada questão'], ['fim', 'Só no fim']] as const).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={correcao === v} onClick={() => setCorrecao(v)} className={`${seg} ${correcao === v ? 'border-[#1f5a2c] bg-[#f1f6ee] text-[#1f5a2c]' : 'border-[#dde3da] bg-white text-[#3d4a41]'}`}>{label}</button>
          ))}
        </div>
      </fieldset>

      {state?.error && <p role="alert" className="mt-4 text-sm font-semibold text-[#c2383e]">{state.error}</p>}

      <div className="fixed inset-x-0 bottom-[calc(var(--ck-banner-h,0px)+84px)] z-20 border-t border-[#e9ece6] bg-white/95 px-4 py-3 backdrop-blur md:sticky md:inset-x-auto md:bottom-4 md:mt-6 md:rounded-[20px] md:border md:px-5 md:shadow-[0_8px_30px_rgba(18,28,21,0.08)]">
        <div className="mx-auto flex max-w-[728px] items-center gap-4">
          <p className="m-0 min-w-0 flex-1 text-sm leading-snug text-[#3d4a41]" aria-live="polite">
            <strong className="block text-base text-[#121c15]">{summary.questions} {summary.questions === 1 ? 'questão' : 'questões'}{summary.minutes ? ` · cerca de ${summary.minutes} min` : ''}</strong>
            <span className="hidden md:inline">{summary.short > 0 ? `${summary.short} ${summary.short === 1 ? 'tema tem' : 'temas têm'} menos questões do que a prova` : 'Simulação com questões de provas anteriores'}</span>
          </p>
          <button type="submit" disabled={pending || summary.questions === 0} className="h-[52px] shrink-0 rounded-[14px] border-0 bg-[#1f5a2c] px-6 text-base font-bold text-white disabled:opacity-50">{pending ? 'A preparar…' : 'Simular a prova'}</button>
        </div>
      </div>
    </form>
  );
}
