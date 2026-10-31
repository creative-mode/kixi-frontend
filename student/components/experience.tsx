'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Ico } from '@/components/ui/ico';
import { EmptyState } from '@/components/states';
import { loadAcademicYearAction } from '@/lib/experience-actions';
import { entrySummary, groupByYear, type AcademicYear, type ExperienceEntry } from '@/lib/experience-rules';
import { formatAverage } from '@/lib/ranking-rules';
import { sinceLabel } from '@/lib/attempt-history';

/**
 * A experiência: a cronologia por ano lectivo, com as escolas e classes que a pessoa frequentou (ou, no
 * professor, o que leccionou). É pública. Só o próprio aluno (`own`) pode abrir um ano e ver o seu histórico
 * académico; para os outros a entrada nem é um botão.
 */
export function Experience({ entries, teacher, own }: { entries: ExperienceEntry[]; teacher: boolean; own: boolean }) {
  const groups = groupByYear(entries);
  const [openId, setOpenId] = useState<string | null>(null);
  const [years, setYears] = useState<Record<string, AcademicYear | string>>({});
  const [pending, start] = useTransition();

  if (groups.length === 0) {
    return <EmptyState title={teacher ? 'Sem experiência de ensino registada' : 'Sem percurso registado'} message={teacher ? 'Os anos letivos e as escolas onde ensina aparecem aqui.' : 'As escolas e as classes por onde passa aparecem aqui, ano a ano.'} />;
  }

  const toggle = (key: string, yearId: number | null) => {
    const next = openId === key ? null : key;
    setOpenId(next);
    if (next && yearId && years[key] === undefined) {
      start(async () => {
        const r = await loadAcademicYearAction(yearId);
        setYears((y) => ({ ...y, [key]: r.ok ? r.year : r.message }));
      });
    }
  };

  return (
    <ol aria-label={teacher ? 'Experiência de ensino' : 'Percurso escolar'} className="relative grid gap-0 px-4 py-5">
      {groups.map((g, i) => {
        const key = g.schoolYear;
        const expanded = openId === key;
        const detail = years[key];
        const canOpen = own && !teacher && g.schoolYearId !== null;
        const head = (
          <>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Ico name={teacher ? 'school' : 'calendar'} filled={expanded} size={22} /></span>
            <b className="min-w-0 flex-1 text-left text-[17px] leading-tight">{g.schoolYear}</b>
            {canOpen && <Ico name="chevron" size={20} className={expanded ? 'rotate-90 transition-transform' : 'transition-transform'} />}
          </>
        );
        return (
          <li key={key} className="rise relative grid gap-2 pb-5 pl-0" style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
            {canOpen ? (
              <button type="button" aria-expanded={expanded} aria-label={`Ano letivo ${g.schoolYear}: ver o teu histórico académico`} onClick={() => toggle(key, g.schoolYearId)} className="flex min-h-12 items-center gap-3 rounded-lg text-left outline-none hover:bg-secondary/60 focus-visible:ring-[3px] focus-visible:ring-ring/40">{head}</button>
            ) : (
              <div className="flex min-h-12 items-center gap-3">{head}</div>
            )}
            <ul className="ml-5 grid gap-3 border-l-2 pl-8">
              {g.entries.map((e, j) => (
                <li key={`${e.school}-${j}`} className="grid gap-0.5">
                  <span className="flex min-w-0 items-center gap-2 font-semibold">
                    <Ico name="building" size={18} className="shrink-0 text-muted-foreground" />
                    {e.schoolId ? <Link href={`/escola/${e.schoolId}`} className="min-w-0 truncate hover:underline focus-visible:underline">{e.school}</Link> : <span className="truncate">{e.school}</span>}
                  </span>
                  {entrySummary(e) && <span className="pl-7 text-[14px] text-muted-foreground">{entrySummary(e)}</span>}
                </li>
              ))}
            </ul>
            {expanded && canOpen && (
              <div className="rise ml-5 border-l-2 pl-8" role="region" aria-label={`Histórico académico de ${g.schoolYear}`}>
                {pending && detail === undefined ? (
                  <p className="py-3 text-sm text-muted-foreground" role="status">A carregar o histórico…</p>
                ) : typeof detail === 'string' ? (
                  <p className="py-3 text-sm text-destructive" role="alert">{detail}</p>
                ) : detail && detail.records.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">Sem provas entregues neste ano letivo.</p>
                ) : detail ? (
                  <div className="grid gap-2 py-2">
                    {detail.average !== null && <p className="text-sm text-muted-foreground">Média do ano <b className="text-lg text-foreground tabular-nums">{formatAverage(detail.average)}</b></p>}
                    <ul className="grid gap-1.5">
                      {detail.records.map((r) => (
                        <li key={r.id}>
                          <Link prefetch={false} href={`/resultado?prova=${r.id}`} className="px-box grid grid-cols-[1fr_auto] items-center gap-3 p-3 [--px-face:var(--secondary)] hover:[--px-face:var(--accent)]">
                            <span className="min-w-0"><b className="block truncate text-sm">{r.title}</b><span className="text-[12px] text-muted-foreground">{[r.subject, sinceLabel(r.finishedAt)].filter(Boolean).join(' · ')}</span></span>
                            <b className="text-lg tabular-nums">{r.score === null ? '–' : formatAverage(r.score)}</b>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
