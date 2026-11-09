'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Download, FileUp, Plus, Save, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { reportActionError } from '@/lib/notify-session-expired';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { getRoomMatrix, removeRoomMatrix, saveRoomMatrix, subjectTopics, tagSubjectQuestions, type SubjectTopic } from '@/app/actions/exam-rooms';
import {
  CSV_TEMPLATE,
  LEVELS,
  draftFrom,
  fold,
  newRow,
  parseMatrixText,
  payloadOf,
  problemsOf,
  totalsOf,
  type Level,
  type MatrixDraft,
  type MatrixRow,
} from '@/lib/exam-rooms/matrix';

const fmt = (n: number) => String(n).replace('.', ',');

/** Preenche as palavras-chave que faltam com as do tema já guardado na disciplina. */
const withKeywords = (draft: MatrixDraft, known: SubjectTopic[]): MatrixDraft => ({
  ...draft,
  rows: draft.rows.map((r) => (r.keywords ? r : { ...r, keywords: known.find((t) => fold(t.name) === fold(r.topic))?.keywords ?? '' })),
});

/**
 * A matriz da prova (matriz de especificação): os temas que saem, quantas questões e que cotação tem cada um, em
 * 20 valores. Os alunos convidados veem-na em «Prepara-te para a prova» e treinam por tema com questões de provas
 * anteriores. Importa-se de um CSV (ou colado do Excel), mas nada é guardado sem o professor rever.
 */
export function RoomMatrix({ roomId, subjectId, readOnly }: { roomId: number; subjectId: number | null; readOnly: boolean }) {
  const [draft, setDraft] = useState<MatrixDraft | null>(null);
  const [saved, setSaved] = useState(false);
  const [topics, setTopics] = useState<SubjectTopic[]>([]);
  const topicsRef = useRef<SubjectTopic[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const listId = useId();

  const load = useCallback(async () => {
    const res = await getRoomMatrix(roomId);
    if (!res.ok) return void setError(res.error);
    setError(null);
    setSaved(res.data != null);
    setDraft(withKeywords(draftFrom(res.data), topicsRef.current));
  }, [roomId]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const loadTopics = useCallback(async () => {
    if (subjectId == null) return;
    const res = await subjectTopics(subjectId);
    if (!res.ok) return;
    topicsRef.current = res.data;
    setTopics(res.data);
    // As palavras-chave já guardadas voltam ao editor, sem pisar o que o professor escreveu.
    setDraft((d) => (d ? withKeywords(d, res.data) : d));
  }, [subjectId]);

  useEffect(() => {
    const task = window.setTimeout(() => void loadTopics(), 0);
    return () => window.clearTimeout(task);
  }, [loadTopics]);

  const totals = useMemo(() => (draft ? totalsOf(draft) : null), [draft]);
  const problems = useMemo(() => (draft ? problemsOf(draft) : []), [draft]);

  if (error) return <Card className="mt-8"><CardContent className="p-6 text-sm text-destructive" role="alert">{error}</CardContent></Card>;
  if (!draft || !totals) return null;

  const set = (patch: Partial<MatrixDraft>) => setDraft({ ...draft, ...patch });
  const setRow = (key: string, patch: Partial<MatrixRow>) => set({ rows: draft.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) });
  const dropRow = (key: string) => set({ rows: draft.rows.filter((r) => r.key !== key) });

  function importText(text: string) {
    const { rows, errors } = parseMatrixText(text);
    setImportErrors(errors);
    if (rows.length > 0 && draft) {
      // Importar substitui as linhas em branco e acrescenta às que já estão, sem apagar o que o professor escreveu.
      const kept = draft.rows.filter((r) => r.topic.trim() !== '' || r.count.trim() !== '');
      setDraft({ ...draft, rows: [...kept, ...rows] });
      toast.success(`${rows.length} ${rows.length === 1 ? 'tema importado' : 'temas importados'}. Reveja e guarde.`);
    }
  }

  async function save() {
    if (!draft || problems.length > 0) return;
    setBusy(true);
    const res = await saveRoomMatrix(roomId, draft, payloadOf(draft), subjectId);
    if (!res.ok) {
      setBusy(false);
      return void reportActionError(res.error);
    }
    setSaved(true);
    const keywords = new Map(draft.rows.map((r) => [fold(r.topic), r.keywords]));
    setDraft({ ...draftFrom(res.data), rows: draftFrom(res.data).rows.map((r) => ({ ...r, keywords: keywords.get(fold(r.topic)) ?? '' })) });
    toast.success('Matriz guardada. Os alunos convidados já a veem para treinar.');
    // Procura logo nas provas anteriores as questões dos temas, para o treino ter com que trabalhar.
    await findQuestions(true);
    setBusy(false);
  }

  async function findQuestions(quiet = false) {
    if (subjectId == null) return;
    if (!quiet) setBusy(true);
    const res = await tagSubjectQuestions(subjectId);
    await loadTopics();
    if (!quiet) setBusy(false);
    if (!res.ok) return void (quiet ? toast.error(res.error) : reportActionError(res.error));
    toast.success(res.data.tagged > 0 ? `${res.data.tagged} ${res.data.tagged === 1 ? 'questão etiquetada' : 'questões etiquetadas'} nas provas anteriores.` : 'Não há questões novas para etiquetar.');
  }

  async function remove() {
    setBusy(true);
    const res = await removeRoomMatrix(roomId);
    setBusy(false);
    if (!res.ok) return void reportActionError(res.error);
    setSaved(false);
    setDraft(draftFrom(null));
    toast.success('Matriz removida.');
  }

  function download() {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'matriz-da-prova.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const scaleOk = Number.isFinite(totals.remaining) && Math.abs(totals.remaining) < 0.01 && totals.points > 0;

  return (
    <section aria-labelledby="matriz-title" className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="matriz-title" className="text-lg font-semibold">Matriz da prova</h2>
          <p className="text-sm text-muted-foreground">Os temas que saem, quantas questões e a cotação de cada um. Os alunos treinam por esta matriz.</p>
        </div>
        <Badge variant={saved ? 'success' : 'secondary'}>{saved ? 'Carregada' : 'Por carregar'}</Badge>
      </div>

      <Card className="mt-4">
        <CardContent className="grid gap-5 p-4 md:p-6">
          {readOnly ? null : (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => file.current?.click()}><FileUp size={14} aria-hidden /> Importar CSV</Button>
              <input
                ref={file}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="sr-only"
                aria-label="Ficheiro da matriz"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) importText(await f.text());
                }}
              />
              <Button type="button" variant="outline" size="sm" aria-expanded={pasting} onClick={() => setPasting((v) => !v)}>Colar do Excel</Button>
              <Button type="button" variant="ghost" size="sm" onClick={download}><Download size={14} aria-hidden /> Modelo CSV</Button>
              {subjectId != null ? (
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void findQuestions()}><Search size={14} aria-hidden /> Procurar questões nas provas anteriores</Button>
              ) : null}
            </div>
          )}

          {pasting && !readOnly ? (
            <div className="grid gap-2">
              <label htmlFor={`${listId}-paste`} className="text-sm font-medium">Cole as linhas: tema, questões, cotação, nível, palavras-chave</label>
              <textarea
                id={`${listId}-paste`}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={5}
                placeholder={'Sub-redes\t3\t7\tAplicação'}
                className="w-full rounded-md border border-input bg-card p-3 font-mono text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
              />
              <div>
                <Button type="button" size="sm" disabled={pasted.trim() === ''} onClick={() => { importText(pasted); setPasted(''); setPasting(false); }}>Importar linhas</Button>
              </div>
            </div>
          ) : null}

          {importErrors.length > 0 ? (
            <ul role="alert" className="grid gap-1 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {importErrors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <div className="grid gap-1.5">
              <label htmlFor={`${listId}-title`} className="text-sm font-medium">Nome da matriz <span className="font-normal text-muted-foreground">(opcional)</span></label>
              <Input id={`${listId}-title`} value={draft.title} disabled={readOnly} maxLength={120} placeholder="Matriz do Teste 2" onChange={(e) => set({ title: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor={`${listId}-scale`} className="text-sm font-medium">A prova vale</label>
              <Input id={`${listId}-scale`} inputMode="decimal" value={draft.totalPoints} disabled={readOnly} onChange={(e) => set({ totalPoints: e.target.value })} aria-describedby={`${listId}-scale-hint`} />
              <span id={`${listId}-scale-hint`} className="sr-only">valores</span>
            </div>
          </div>

          <datalist id={listId}>{topics.map((t) => <option key={t.id} value={t.name} />)}</datalist>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Tema</th>
                  <th className="w-24 pb-2 pr-2 font-medium">Questões</th>
                  <th className="w-24 pb-2 pr-2 font-medium">Valores</th>
                  <th className="w-44 pb-2 pr-2 font-medium">Nível</th>
                  <th className="w-64 pb-2 pr-2 font-medium">Palavras-chave</th>
                  <th className="w-10 pb-2"><span className="sr-only">Remover</span></th>
                </tr>
              </thead>
              <tbody>
                {draft.rows.map((row, i) => (
                  <tr key={row.key} className="align-top">
                    <td className="pb-2 pr-2">
                      <Input aria-label={`Tema da linha ${i + 1}`} list={listId} value={row.topic} disabled={readOnly} maxLength={120} placeholder="Sub-redes" onChange={(e) => setRow(row.key, { topic: e.target.value })} />
                      {(() => {
                        const known = topics.find((t) => fold(t.name) === fold(row.topic));
                        if (!known) return null;
                        return known.questionCount > 0
                          ? <span className="mt-1 block text-xs text-muted-foreground">{known.questionCount} {known.questionCount === 1 ? 'questão' : 'questões'} nas provas</span>
                          : <span className="mt-1 block text-xs text-warning">Sem questões nas provas: junte palavras-chave.</span>;
                      })()}
                    </td>
                    <td className="pb-2 pr-2"><Input aria-label={`Questões da linha ${i + 1}`} inputMode="numeric" value={row.count} disabled={readOnly} onChange={(e) => setRow(row.key, { count: e.target.value })} /></td>
                    <td className="pb-2 pr-2"><Input aria-label={`Valores da linha ${i + 1}`} inputMode="decimal" value={row.points} disabled={readOnly} onChange={(e) => setRow(row.key, { points: e.target.value })} /></td>
                    <td className="pb-2 pr-2">
                      <NativeSelect aria-label={`Nível da linha ${i + 1}`} value={row.level} disabled={readOnly} onChange={(e) => setRow(row.key, { level: e.target.value as Level | '' })}>
                        <option value="">Sem nível</option>
                        {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </NativeSelect>
                    </td>
                    <td className="pb-2 pr-2"><Input aria-label={`Palavras-chave da linha ${i + 1}`} value={row.keywords} disabled={readOnly} placeholder="máscara, /24, host" onChange={(e) => setRow(row.key, { keywords: e.target.value })} /></td>
                    <td className="pb-2">
                      {readOnly ? null : (
                        <Button type="button" variant="ghost" size="icon" aria-label={`Remover a linha ${i + 1}`} onClick={() => dropRow(row.key)}><Trash2 size={15} aria-hidden /></Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {readOnly ? null : (
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => set({ rows: [...draft.rows, newRow()] })}><Plus size={14} aria-hidden /> Acrescentar tema</Button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p role="status" className="text-sm tabular-nums">
              <strong>{totals.questions}</strong> {totals.questions === 1 ? 'questão' : 'questões'} · <strong className={scaleOk ? 'text-success' : undefined}>{fmt(totals.points)}</strong> de {draft.totalPoints || '?'} valores
              {totals.points > 0 && !scaleOk && Number.isFinite(totals.remaining) ? (
                <span className="text-muted-foreground"> · {totals.remaining > 0 ? `faltam ${fmt(totals.remaining)}` : `sobram ${fmt(-totals.remaining)}`}</span>
              ) : null}
            </p>
            {readOnly ? null : (
              <div className="flex gap-2">
                {saved ? <Button type="button" variant="outline" className="text-destructive" disabled={busy} onClick={remove}>Remover matriz</Button> : null}
                <Button type="button" disabled={busy || problems.length > 0} onClick={save}><Save size={15} aria-hidden /> Guardar matriz</Button>
              </div>
            )}
          </div>
          {!readOnly && problems.length > 0 && draft.rows.some((r) => r.topic.trim() !== '' || r.count.trim() !== '') ? (
            <ul className="-mt-2 grid gap-0.5 text-sm text-muted-foreground">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
