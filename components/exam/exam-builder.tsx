'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Printer, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import Link from 'next/link';
import { createManualStatement, institutionLinks, myInstitutions } from '@/app/actions/crud';
import { EMPTY_DRAFT, KINDS, loadDraft, saveDraft, type ExamDraft, type School } from '@/lib/exam/schools';
import { problems, toRequest, totalScore, unscored } from '@/lib/exam/draft';
import { ExamSheet } from './exam-sheet';
import { QuestionEditor } from './question-editor';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>;
}

export function ExamBuilder() {
  const [schools, setSchools] = useState<School[]>([]);
  const [subjectIds, setSubjectIds] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<ExamDraft>(EMPTY_DRAFT);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  // As escolas vêm do backend: só aquelas a que o professor está afiliado (o administrador vê todas).
  useEffect(() => {
    const task = window.setTimeout(() => setDraft(loadDraft()), 0);
    myInstitutions().then((res) => {
      if (!res.ok) toast.error(res.error);
      else setSchools(res.data.map((i) => ({ id: String(i.id), name: i.name, logo: i.logo ?? '', subjects: [] })));
      setReady(true);
    });
    return () => window.clearTimeout(task);
  }, []);
  useEffect(() => { if (ready) saveDraft(draft); }, [draft, ready]);

  const school = useMemo(() => schools.find((s) => s.id === draft.schoolId) ?? schools[0], [schools, draft.schoolId]);
  const schoolId = school?.id;
  const set = <K extends keyof ExamDraft>(k: K, v: ExamDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  // As disciplinas são as da escola escolhida.
  useEffect(() => {
    if (!schoolId) return;
    institutionLinks(Number(schoolId), 'subjects').then((res) => {
      if (!res.ok) return toast.error(res.error);
      setSubjectIds(Object.fromEntries(res.data.map((x) => [x.name, x.id])));
      setSchools((all) => all.map((x) => (x.id === schoolId ? { ...x, subjects: res.data.map((y) => y.name) } : x)));
      setDraft((d) => (d.subject && !res.data.some((y) => y.name === d.subject) ? { ...d, subject: '' } : d));
    });
  }, [schoolId]);

  async function save() {
    if (!school || !draft.subject) return;
    setSaving(true);
    const res = await createManualStatement({
      institutionId: Number(school.id),
      subjectId: subjectIds[draft.subject],
      title: `${draft.kind} – ${draft.subject}`,
      examType: draft.kind,
      instructions: draft.rules.filter(Boolean).join('\n') || null,
      visible: false,
      // O gabarito viaja no próprio pedido: `ManualStatementRequest.Option.correct` é
      // honrado na criação, por isso marcar a resposta certa não custa um segundo pedido.
      questions: toRequest(draft.items),
    });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success('Prova guardada. Fica oculta até a publicar no enunciado.');
  }

  const setItem = (i: number, patch: Partial<ExamDraft['items'][number]>) => set('items', draft.items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setRule = (i: number, v: string) => set('rules', draft.rules.map((x, j) => (j === i ? v : x)));
  /** Reordena no rascunho; a ordem vai no pedido de criação, que é quem a guarda. */
  const moveItem = (i: number, direction: -1 | 1) => {
    const to = i + direction;
    if (to < 0 || to >= draft.items.length) return;
    set('items', [...draft.items.slice(0, i + direction), draft.items[i], draft.items[i - direction], ...draft.items.slice(Math.max(i, to) + 1)]);
  };
  const total = totalScore(draft.items);
  const problemas = problems(draft.items);
  const ready2print = !!school && !!draft.subject && draft.items.some((i) => i.text.trim());

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8 lg:p-10">
      <style>{`@media print{body *{visibility:hidden}#exam-sheet,#exam-sheet *{visibility:visible}#exam-sheet{position:absolute;left:0;top:0;width:100%;box-shadow:none}@page{size:A4;margin:10mm}}`}</style>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl leading-tight tracking-tight">Montar prova</h1>
          <p className="mt-1 text-muted-foreground">A prova segue o modelo oficial. Só o logótipo, o nome da escola e a disciplina mudam.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={save} disabled={!ready2print || saving} title={ready2print ? undefined : 'Escolha a disciplina e escreva pelo menos uma questão'}>
            <Save aria-hidden /> Guardar prova
          </Button>
          <Button onClick={() => window.print()} disabled={!ready2print}>
            <Printer aria-hidden /> Imprimir / guardar PDF
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="grid gap-4 print:hidden">
          <Card>
            <CardHeader>
              <CardTitle>Escola e disciplina</CardTitle>
              <CardDescription>A prova pertence a uma escola e a uma disciplina dessa escola.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {ready && schools.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Não está afiliado a nenhuma escola. Peça a um administrador que o associe a uma <Link href="/institutions" className="underline">instituição</Link>.
                </p>
              ) : (
                <>
                  <Field label="Escola">
                    <NativeSelect value={school?.id ?? ''} onChange={(e) => set('schoolId', e.target.value)}>
                      {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </NativeSelect>
                  </Field>
                  <Field label="Disciplina">
                    <NativeSelect value={draft.subject} onChange={(e) => set('subject', e.target.value)}>
                      <option value="">Escolher…</option>
                      {(school?.subjects ?? []).map((x) => <option key={x} value={x}>{x}</option>)}
                    </NativeSelect>
                  </Field>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Cabeçalho</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-[1fr_1.5fr_1fr]">
              <Field label="Classe"><Input value={draft.grade} onChange={(e) => set('grade', e.target.value)} /></Field>
              <Field label="Tipo">
                <NativeSelect value={draft.kind} onChange={(e) => set('kind', e.target.value)}>{KINDS.map((k) => <option key={k}>{k}</option>)}</NativeSelect>
              </Field>
              <Field label="Fase"><Input value={draft.phase} onChange={(e) => set('phase', e.target.value)} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Questões</CardTitle>
              <CardDescription>
                Cada questão pode ter cotação em valores. Uma pergunta com opções é de escolha múltipla, e precisa de resposta correcta marcada para a prova poder ser publicada.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {draft.items.map((it, i) => (
                <QuestionEditor
                  key={i}
                  item={it}
                  index={i}
                  total={draft.items.length}
                  onChange={(patch) => setItem(i, patch)}
                  onRemove={() => set('items', draft.items.filter((_, j) => j !== i))}
                  onMove={(direction) => moveItem(i, direction)}
                />
              ))}
              <Button variant="outline" size="sm" className="justify-self-start" onClick={() => set('items', [...draft.items, { text: '', points: '', options: [] }])}><Plus aria-hidden /> Questão</Button>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-3 text-sm">
                <span className="text-muted-foreground">
                  {draft.items.filter((i) => i.text.trim()).length} questão(s), <b className="text-foreground">{total} valores</b>
                </span>
                {unscored(draft.items) > 0 && (
                  // A soma do servidor **filtra** as perguntas sem cotação em vez de as
                  // contar como zero. O total declarado sai menor do que a folha sugere
                  // e o `/approve` recusa-o, sem dizer porquê.
                  <span className="text-muted-foreground">{unscored(draft.items)} sem cotação, e sem cotação não conta para o total</span>
                )}
              </div>
              {problemas.length > 0 && (
                <ul role="status" className="grid gap-1 rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning">
                  {problemas.map((p) => <li key={p}>{p}</li>)}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Regras e rodapé</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {draft.rules.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={r} onChange={(e) => setRule(i, e.target.value)} aria-label={`Regra ${i + 1}`} />
                  <Button variant="ghost" size="icon" aria-label={`Remover regra ${i + 1}`} onClick={() => set('rules', draft.rules.filter((_, j) => j !== i))}><Trash2 /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="justify-self-start" onClick={() => set('rules', [...draft.rules, ''])}><Plus aria-hidden /> Regra</Button>
              <Field label="Observação"><Input value={draft.note} onChange={(e) => set('note', e.target.value)} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Local"><Input value={draft.place} onChange={(e) => set('place', e.target.value)} /></Field>
                <Field label="Data"><Input type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} /></Field>
              </div>
              <Field label="Professor"><Input value={draft.teacher} onChange={(e) => set('teacher', e.target.value)} /></Field>
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-24">
          <ExamSheet school={school} draft={draft} />
        </div>
      </div>
    </div>
  );
}
