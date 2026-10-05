'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Printer, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { createManualStatement, institutionLinks, myInstitutions } from '@/app/actions/crud';
import { EMPTY_DRAFT, KINDS, loadDraft, saveDraft, type ExamDraft, type School } from '@/lib/exam/schools';
import { ExamSheet } from './exam-sheet';

const select = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

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
    setDraft(loadDraft());
    myInstitutions().then((res) => {
      if (!res.ok) toast.error(res.error);
      else setSchools(res.data.map((i) => ({ id: String(i.id), name: i.name, logo: i.logo ?? '', subjects: [] })));
      setReady(true);
    });
  }, []);
  useEffect(() => { if (ready) saveDraft(draft); }, [draft, ready]);

  const school = useMemo(() => schools.find((s) => s.id === draft.schoolId) ?? schools[0], [schools, draft.schoolId]);
  const set = <K extends keyof ExamDraft>(k: K, v: ExamDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  // As disciplinas são as da escola escolhida.
  useEffect(() => {
    if (!school) return;
    institutionLinks(Number(school.id), 'subjects').then((res) => {
      if (!res.ok) return toast.error(res.error);
      setSubjectIds(Object.fromEntries(res.data.map((x) => [x.name, x.id])));
      setSchools((all) => all.map((x) => (x.id === school.id ? { ...x, subjects: res.data.map((y) => y.name) } : x)));
      setDraft((d) => (d.subject && !res.data.some((y) => y.name === d.subject) ? { ...d, subject: '' } : d));
    });
  }, [school?.id]);

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
      questions: draft.items.filter((i) => i.text.trim()).map((i) => ({ text: i.text.trim(), maxScore: i.points === '' ? null : i.points })),
    });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success('Prova guardada');
  }

  const setItem = (i: number, patch: Partial<ExamDraft['items'][number]>) => set('items', draft.items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setRule = (i: number, v: string) => set('rules', draft.rules.map((x, j) => (j === i ? v : x)));
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
                    <select className={select} value={school?.id ?? ''} onChange={(e) => set('schoolId', e.target.value)}>
                      {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Disciplina">
                    <select className={select} value={draft.subject} onChange={(e) => set('subject', e.target.value)}>
                      <option value="">Escolher…</option>
                      {(school?.subjects ?? []).map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
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
                <select className={select} value={draft.kind} onChange={(e) => set('kind', e.target.value)}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
              </Field>
              <Field label="Fase"><Input value={draft.phase} onChange={(e) => set('phase', e.target.value)} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Questões</CardTitle><CardDescription>Cada questão pode ter cotação em valores.</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              {draft.items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_72px_auto] items-start gap-2">
                  <Textarea rows={2} value={it.text} onChange={(e) => setItem(i, { text: e.target.value })} placeholder={`Questão ${i + 1}`} aria-label={`Questão ${i + 1}`} />
                  <Input type="number" min={0} step="0.5" value={it.points} onChange={(e) => setItem(i, { points: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="Val." aria-label={`Cotação da questão ${i + 1}`} />
                  <Button variant="ghost" size="icon" aria-label={`Remover questão ${i + 1}`} onClick={() => set('items', draft.items.filter((_, j) => j !== i))} disabled={draft.items.length === 1}><Trash2 /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="justify-self-start" onClick={() => set('items', [...draft.items, { text: '', points: '' }])}><Plus aria-hidden /> Questão</Button>
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
