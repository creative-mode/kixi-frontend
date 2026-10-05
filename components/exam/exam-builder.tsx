'use client';

import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Plus, Printer, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  EMPTY_DRAFT, KINDS, imageToDataUri, loadDraft, loadSchools, saveDraft, saveSchools, slug,
  type ExamDraft, type School,
} from '@/lib/exam/schools';
import { ExamSheet } from './exam-sheet';

const select = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>;
}

/** Formulário de escola: nome, logótipo e disciplinas leccionadas. */
function SchoolForm({ initial, onSave, onCancel }: { initial?: School; onSave: (s: School) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [logo, setLogo] = useState(initial?.logo ?? '');
  const [subjects, setSubjects] = useState((initial?.subjects ?? []).join('\n'));

  async function pick(file?: File) {
    if (!file) return;
    try { setLogo(await imageToDataUri(file)); } catch { toast.error('Não foi possível ler a imagem.'); }
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const list = [...new Set(subjects.split('\n').map((s) => s.trim()).filter(Boolean))];
    if (name.trim().length < 3) return toast.error('Indique o nome da escola.');
    if (list.length === 0) return toast.error('Indique pelo menos uma disciplina.');
    onSave({ id: initial?.id ?? (slug(name) || crypto.randomUUID()), name: name.trim(), logo, subjects: list });
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-lg border bg-muted/40 p-4">
      <Field label="Nome da escola"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Instituto de Telecomunicações" /></Field>
      <Field label="Logótipo">
        <div className="flex items-center gap-3">
          <span className="grid size-14 place-items-center overflow-hidden rounded-md border bg-card">
            {logo ? <img src={logo} alt="" className="max-h-full max-w-full object-contain" /> : <ImagePlus className="size-5 text-muted-foreground" aria-hidden />}
          </span>
          <Input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} className="max-w-xs" />
        </div>
      </Field>
      <Field label="Disciplinas (uma por linha)"><Textarea rows={4} value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder={'Matemática\nFísica'} /></Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" size="sm">Guardar escola</Button>
      </div>
    </form>
  );
}

export function ExamBuilder() {
  const [schools, setSchools] = useState<School[]>([]);
  const [draft, setDraft] = useState<ExamDraft>(EMPTY_DRAFT);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<'new' | 'edit' | null>(null);

  useEffect(() => {
    setSchools(loadSchools());
    setDraft(loadDraft());
    setReady(true);
  }, []);
  useEffect(() => { if (ready) saveDraft(draft); }, [draft, ready]);

  const school = useMemo(() => schools.find((s) => s.id === draft.schoolId) ?? schools[0], [schools, draft.schoolId]);
  const set = <K extends keyof ExamDraft>(k: K, v: ExamDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  // A disciplina tem de pertencer à escola escolhida.
  useEffect(() => {
    if (!ready || !school) return;
    if (draft.subject && !school.subjects.includes(draft.subject)) setDraft((d) => ({ ...d, subject: '' }));
  }, [ready, school, draft.subject]);

  function persist(next: School[]) { setSchools(next); saveSchools(next); }
  function saveSchool(s: School) {
    persist(schools.some((x) => x.id === s.id) ? schools.map((x) => (x.id === s.id ? s : x)) : [...schools, s]);
    set('schoolId', s.id);
    setEditing(null);
    toast.success('Escola guardada');
  }
  function removeSchool() {
    if (!school || schools.length <= 1) return toast.error('Tem de existir pelo menos uma escola.');
    if (!confirm(`Remover "${school.name}"?`)) return;
    const next = schools.filter((s) => s.id !== school.id);
    persist(next);
    set('schoolId', next[0].id);
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
        <Button onClick={() => window.print()} disabled={!ready2print} title={ready2print ? undefined : 'Escolha a disciplina e escreva pelo menos uma questão'}>
          <Printer aria-hidden /> Imprimir / guardar PDF
        </Button>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="grid gap-4 print:hidden">
          <Card>
            <CardHeader>
              <CardTitle>Escola e disciplina</CardTitle>
              <CardDescription>A prova pertence a uma escola e a uma disciplina dessa escola.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {editing ? (
                <SchoolForm initial={editing === 'edit' ? school : undefined} onSave={saveSchool} onCancel={() => setEditing(null)} />
              ) : (
                <>
                  <Field label="Escola">
                    <select className={select} value={school?.id ?? ''} onChange={(e) => set('schoolId', e.target.value)}>
                      {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing('new')}><Plus aria-hidden /> Nova escola</Button>
                    <Button variant="outline" size="sm" onClick={() => setEditing('edit')} disabled={!school}>Editar</Button>
                    <Button variant="ghost" size="sm" onClick={removeSchool} disabled={schools.length <= 1} className="text-destructive"><Trash2 aria-hidden /> Remover</Button>
                  </div>
                  <Field label="Disciplina">
                    <select className={select} value={draft.subject} onChange={(e) => set('subject', e.target.value)}>
                      <option value="">Escolher…</option>
                      {(school?.subjects ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
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
