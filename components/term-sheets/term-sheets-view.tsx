'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, TrendingDown, UserX, Users } from 'lucide-react';
import { getTermSheet, listTermSheets } from '@/app/actions/term-sheets';
import { ACTION_TIMEOUT_MS, withDeadline } from '@/lib/timeout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { SectionState } from '@/components/dashboard/section-state';
import { applyFilters, filterOptions, formatGrade, isFinal, NO_FILTERS, SHEET_STATUS_LABEL, sheetTitle, termLabel, type SheetFilters } from '@/lib/term-sheets';
import type { Section } from '@/types/analytics';
import type { TermSheetDetail, TermSheetSummary } from '@/types/term-sheets';
import { TermSheetTable } from './term-sheet-table';

const failed = <T,>(message = 'Não foi possível carregar. Tente novamente.'): Section<T> => ({ ok: false, error: message });

/**
 * As pautas do trimestre: a lista do que o utilizador pode ver (o backend aplica o âmbito: o ADMIN todas, o
 * professor as das suas turmas e disciplinas) e, ao escolher uma, a tabela por aluno. Ainda sem PDFs (kixi-frontend#645).
 */
export function TermSheetsView() {
  const [sheets, setSheets] = useState<Section<TermSheetSummary[]> | null>(null);
  const [filters, setFilters] = useState<SheetFilters>(NO_FILTERS);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Section<TermSheetDetail> | null>(null);
  const request = useRef(0);

  const loadList = useCallback(async () => {
    setSheets(null);
    try {
      setSheets(await withDeadline(listTermSheets(), ACTION_TIMEOUT_MS));
    } catch {
      setSheets(failed('Não foi possível contactar o servidor. Tente novamente.'));
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void loadList(), 0);
    return () => window.clearTimeout(task);
  }, [loadList]);

  const loadDetail = useCallback(async (id: string) => {
    const mine = ++request.current;
    setDetail(null);
    try {
      const result = await withDeadline(getTermSheet(id), ACTION_TIMEOUT_MS);
      if (mine === request.current) setDetail(result);
    } catch {
      if (mine === request.current) setDetail(failed('Não foi possível contactar o servidor. Tente novamente.'));
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    const task = window.setTimeout(() => void loadDetail(selected), 0);
    return () => window.clearTimeout(task);
  }, [selected, loadDetail]);

  const all = sheets?.ok ? sheets.data : null;
  const options = useMemo(() => filterOptions(all ?? []), [all]);
  const visible = useMemo(() => applyFilters(all ?? [], filters), [all, filters]);
  const filtered = useMemo<Section<TermSheetSummary[]> | null>(() => (sheets && sheets.ok ? { ok: true, data: visible } : sheets), [sheets, visible]);
  const set = (key: keyof SheetFilters) => (e: React.ChangeEvent<HTMLSelectElement>) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8 lg:p-10">
      <div>
        <h1 className="text-2xl leading-tight tracking-tight text-foreground">Pautas</h1>
        <p className="mt-1 text-muted-foreground">As pautas trimestrais das turmas e disciplinas que lecciona, com as notas de cada aluno.</p>
      </div>

      {all && all.length > 0 ? (
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filtrar pautas" onSubmit={(e) => e.preventDefault()}>
          <div className="grid gap-1.5">
            <Label htmlFor="f-ano">Ano lectivo</Label>
            <NativeSelect id="f-ano" value={filters.schoolYear} onChange={set('schoolYear')}>
              <option value="">Todos</option>
              {options.schoolYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-trimestre">Trimestre</Label>
            <NativeSelect id="f-trimestre" value={filters.termNumber} onChange={set('termNumber')}>
              <option value="">Todos</option>
              {options.terms.map((t) => <option key={t} value={t}>{termLabel(t)}</option>)}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-turma">Turma</Label>
            <NativeSelect id="f-turma" value={filters.classId} onChange={set('classId')}>
              <option value="">Todas</option>
              {options.classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-disciplina">Disciplina</Label>
            <NativeSelect id="f-disciplina" value={filters.subjectId} onChange={set('subjectId')}>
              <option value="">Todas</option>
              {options.subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </NativeSelect>
          </div>
        </form>
      ) : null}

      <SectionState
        section={filtered}
        onRetry={() => void loadList()}
        isEmpty={(d) => d.length === 0}
        empty={all && all.length > 0 ? 'Nenhuma pauta com estes filtros. Limpe um filtro para ver mais.' : 'Ainda não há pautas. Aparecem aqui quando o motor as regista no fim de cada trimestre.'}
      >
        {(list) => (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Pautas">
            {list.map((s) => (
              <li key={s.sheetId}>
                <button
                  type="button"
                  onClick={() => setSelected(s.sheetId)}
                  aria-pressed={selected === s.sheetId}
                  className="w-full rounded-lg text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <Card className={`gap-3 transition-colors hover:bg-accent/40 ${selected === s.sheetId ? 'border-primary ring-1 ring-primary' : ''}`}>
                    <CardHeader>
                      <CardTitle className="text-base">{s.subjectName}</CardTitle>
                      <CardDescription>{s.grade}.ª {s.className} · {s.course} · {termLabel(s.termNumber)} · {s.schoolYear}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <Badge variant={isFinal(s) ? 'success' : s.status === 'ANULADA' ? 'destructive' : 'warning'}>{SHEET_STATUS_LABEL[s.status]}</Badge>
                      <span className="text-muted-foreground tabular-nums">
                        Média {formatGrade(s.statistics.media)} · {s.statistics.avaliados}/{s.statistics.inscritos} avaliados
                      </span>
                    </CardContent>
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionState>

      {selected ? (
        <section aria-live="polite" aria-label="Detalhe da pauta" className="space-y-4">
          <SectionState section={detail} onRetry={() => void loadDetail(selected)} skeletonClassName="h-56">
            {(d) => (
              <>
                <div>
                  <h2 className="text-xl leading-tight text-foreground">{sheetTitle(d)}</h2>
                  <p className="text-sm text-muted-foreground">
                    {d.course} · {d.schoolYear} · {SHEET_STATUS_LABEL[d.status]}
                    {d.status === 'REGISTADA' ? ' (ainda não homologada)' : ''}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <KpiCard label="Média da turma" value={formatGrade(d.statistics.media)} hint={`de ${formatGrade(d.statistics.notaMinima)} a ${formatGrade(d.statistics.notaMaxima)}`} icon={ClipboardList} />
                  <KpiCard label="Positivas" value={`${d.statistics.positivas}`} hint={`de ${d.statistics.avaliados} avaliados`} icon={Users} accent="radar" />
                  <KpiCard label="Negativas" value={`${d.statistics.negativas}`} hint="MT abaixo de 10" icon={TrendingDown} accent="tiro" />
                  <KpiCard label="Ausentes" value={`${d.statistics.ausentes}`} hint="incompletos, sem nota" icon={UserX} accent="tiro" />
                </div>
                <Card>
                  <CardContent className="px-0">
                    <TermSheetTable rows={d.rows} caption={`Pauta de ${sheetTitle(d)}`} />
                  </CardContent>
                </Card>
              </>
            )}
          </SectionState>
        </section>
      ) : null}
    </div>
  );
}
