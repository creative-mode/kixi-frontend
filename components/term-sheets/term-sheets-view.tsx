'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, TrendingDown, UserX, Users } from 'lucide-react';
import { getSheetExports, getTermSheet, listTermSheets } from '@/app/actions/term-sheets';
import { ACTION_TIMEOUT_MS, withDeadline } from '@/lib/timeout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { SectionState } from '@/components/dashboard/section-state';
import { applyFilters, classLabel, filterOptions, formatGrade, dispensedNote, isFinal, NO_FILTERS, schoolYearLabel, SHEET_STATUS_LABEL, sheetTitle, subjectLabel, termLabel, type SheetFilters } from '@/lib/term-sheets';
import type { Section } from '@/types/analytics';
import { exportBlockedReason, isProvisional } from '@/lib/term-sheet-export';
import type { SheetExports, TermSheetDetail, TermSheetSummary } from '@/types/term-sheets';
import { ExportPdfButton } from './export-pdf-button';
import { TermSheetTable } from './term-sheet-table';

const failed = <T,>(message = 'Não foi possível carregar. Tente novamente.'): Section<T> => ({ ok: false, error: message });

/**
 * As pautas do trimestre: a lista do que o utilizador pode ver (o backend aplica o âmbito: o ADMIN todas, o
 * professor as das suas turmas e disciplinas) e, ao escolher uma, a tabela por aluno. Quem pode exportar (`canExport`) tem o
 * PDF da pauta em cada cartão e, no detalhe, a pauta da turma e o resultado de cada prova (kixi-frontend#808, kixi#627).
 */
export function TermSheetsView({ canExport = false }: { canExport?: boolean }) {
  const [sheets, setSheets] = useState<Section<TermSheetSummary[]> | null>(null);
  const [filters, setFilters] = useState<SheetFilters>(NO_FILTERS);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Section<TermSheetDetail> | null>(null);
  const [exports, setExports] = useState<Section<SheetExports> | null>(null);
  const request = useRef(0);
  const exportsRequest = useRef(0);

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

  // As provas com resultado em PDF saem do plano do trimestre, que a pauta não traz: um pedido à parte, que não atrasa a tabela.
  const loadExports = useCallback(async (id: string) => {
    const mine = ++exportsRequest.current;
    setExports(null);
    try {
      const result = await withDeadline(getSheetExports(id), ACTION_TIMEOUT_MS);
      if (mine === exportsRequest.current) setExports(result);
    } catch {
      if (mine === exportsRequest.current) setExports(failed('Não foi possível contactar o servidor. Tente novamente.'));
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    const task = window.setTimeout(() => {
      void loadDetail(selected);
      if (canExport) void loadExports(selected);
    }, 0);
    return () => window.clearTimeout(task);
  }, [selected, loadDetail, loadExports, canExport]);

  const all = sheets?.ok ? sheets.data : null;
  const options = useMemo(() => filterOptions(all ?? []), [all]);
  const visible = useMemo(() => applyFilters(all ?? [], filters), [all, filters]);
  const filtered = useMemo<Section<TermSheetSummary[]> | null>(() => (sheets && sheets.ok ? { ok: true, data: visible } : sheets), [sheets, visible]);
  const set = (key: keyof SheetFilters) => (e: React.ChangeEvent<HTMLSelectElement>) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8 lg:p-10">
      <div>
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-foreground">Pautas</h1>
        <p className="mt-1 text-muted-foreground">As pautas trimestrais das turmas e disciplinas a que tem acesso, com as notas de cada aluno.</p>
      </div>

      {all && all.length > 0 ? (
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filtrar pautas" onSubmit={(e) => e.preventDefault()}>
          <div className="grid gap-1.5">
            <Label htmlFor="f-ano">Ano letivo</Label>
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
              <li key={s.sheetId} className="h-full">
                {/* O cartão escolhe a pauta; o PDF é um botão irmão, fora dele, para não haver um botão dentro de outro. */}
                <Card className={`h-full gap-3 transition-colors hover:bg-accent/40 ${selected === s.sheetId ? 'border-primary ring-1 ring-primary' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setSelected(s.sheetId)}
                    aria-pressed={selected === s.sheetId}
                    className="flex w-full flex-col gap-3 rounded-lg text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <CardHeader className="w-full">
                      <CardTitle className="text-base">{subjectLabel(s)}</CardTitle>
                      <CardDescription>{classLabel(s)} · {termLabel(s.termNumber)} · {schoolYearLabel(s.schoolYear)}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex w-full flex-wrap items-center justify-between gap-2 text-sm">
                      <Badge variant={isFinal(s) ? 'success' : s.status === 'ANULADA' ? 'destructive' : 'warning'}>{SHEET_STATUS_LABEL[s.status]}</Badge>
                      <span className="text-muted-foreground tabular-nums">
                        Média {formatGrade(s.statistics.media)} · {s.statistics.avaliados}/{s.statistics.inscritos} avaliados
                      </span>
                    </CardContent>
                  </button>
                  {canExport ? (
                    <CardFooter className="mt-auto">
                      <ExportPdfButton
                        sheetId={s.sheetId}
                        accessibleName={`Exportar PDF da pauta de ${sheetTitle(s)}`}
                        provisional={isProvisional(s)}
                        disabledReason={exportBlockedReason(s)}
                      />
                    </CardFooter>
                  ) : null}
                </Card>
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
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl leading-tight text-foreground">{sheetTitle(d)}</h2>
                    <p className="text-sm text-muted-foreground">
                      {d.course || classLabel(d)} · {schoolYearLabel(d.schoolYear)} · {SHEET_STATUS_LABEL[d.status]}
                      {d.status === 'REGISTADA' ? ' (ainda não homologada)' : ''}
                    </p>
                  </div>
                  {canExport ? (
                    <div className="flex flex-wrap items-start gap-3">
                      <ExportPdfButton
                        sheetId={d.sheetId}
                        label="Exportar pauta em PDF"
                        size="default"
                        provisional={isProvisional(d)}
                        disabledReason={exportBlockedReason(d)}
                      />
                      <ExportPdfButton
                        sheetId={d.sheetId}
                        classSheet
                        label="Exportar pauta da turma"
                        accessibleName="Exportar PDF da pauta da turma"
                        size="default"
                        provisional={isProvisional(d)}
                        disabledReason={exportBlockedReason(d)}
                      />
                    </div>
                  ) : null}
                </div>
                {canExport && !exportBlockedReason(d) ? <ResultExports sheetId={d.sheetId} provisional={isProvisional(d)} exports={exports} /> : null}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <KpiCard label="Média da turma" value={formatGrade(d.statistics.media)} hint={`de ${formatGrade(d.statistics.notaMinima)} a ${formatGrade(d.statistics.notaMaxima)}`} icon={ClipboardList} />
                  <KpiCard label="Positivas" value={`${d.statistics.positivas}`} hint={`de ${d.statistics.avaliados} avaliados`} icon={Users} accent="radar" />
                  <KpiCard label="Negativas" value={`${d.statistics.negativas}`} hint="MT abaixo de 10" icon={TrendingDown} accent="tiro" />
                  <KpiCard label="Ausentes" value={`${d.statistics.ausentes}`} hint="incompletos, sem nota" icon={UserX} accent="tiro" />
                </div>
                <Card>
                  <CardContent className="px-0">
                    <TermSheetTable rows={d.rows} caption={`Pauta de ${sheetTitle(d)}`} dispensed={d.dispensed} />
                    {dispensedNote(d.dispensed) ? <p className="px-4 pt-3 text-xs text-muted-foreground" data-testid="pauta-mt-regra">{dispensedNote(d.dispensed)}</p> : null}
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

/** O resultado de cada prova da pauta em PDF. Sem plano ou sem provas com enunciado, diz porquê em vez de esconder. */
function ResultExports({ sheetId, provisional, exports }: { sheetId: string; provisional: boolean; exports: Section<SheetExports> | null }) {
  return (
    <section aria-label="Resultados das provas em PDF" className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">Resultados das provas</h3>
      {exports === null ? (
        <p className="text-sm text-muted-foreground" role="status">A procurar as provas desta pauta…</p>
      ) : !exports.ok ? (
        <p className="text-sm text-muted-foreground">{exports.error}</p>
      ) : exports.data.assessments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma prova desta pauta tem resultado corrigido para exportar.</p>
      ) : (
        <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Provas">
          {exports.data.assessments.map((a) => (
            <li key={a.id}>
              <ExportPdfButton sheetId={sheetId} assessmentId={a.id} label={`Resultado ${a.title}`} accessibleName={`Exportar PDF do resultado da ${a.title}`} provisional={provisional} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
