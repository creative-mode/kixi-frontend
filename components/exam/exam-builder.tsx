'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, DoorOpen, FileText, Plus, Printer, Save, ScanText, Sparkles, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import Link from 'next/link';
import { createManualStatement, myInstitutions, publishManualStatement, reviewChoices, type ReviewChoices } from '@/app/actions/crud';
import { fetchCurrentUser } from '@/lib/auth';
import { classChoices, subjectChoices } from '@/lib/exam/curriculum';
import { EMPTY_DRAFT, KINDS, loadDraft, saveDraft, type ExamDraft, type School } from '@/lib/exam/schools';
import { distributeScore, move, problems, toRequest, totalScore, unscored } from '@/lib/exam/draft';
import { draftFromExtraction, type ExamExtraction } from '@/lib/exam/extraction';
import { ExamImporter } from './exam-importer';
import { ExamSheet } from './exam-sheet';
import { QuestionEditor } from './question-editor';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>;
}

/** A prova que acabou de ser guardada: serve para dizer onde está e para a poder dar a uma turma. */
interface SavedExam { id: number; title: string; published: boolean; snapshot: string }

export function ExamBuilder({ openImport = false }: { openImport?: boolean }) {
  const [schools, setSchools] = useState<School[]>([]);
  const [subjectIds, setSubjectIds] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<ExamDraft>(EMPTY_DRAFT);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [choices, setChoices] = useState<ReviewChoices | null>(null);
  const [classId, setClassId] = useState('');
  const [importOpen, setImportOpen] = useState(openImport);
  const [notes, setNotes] = useState<string[]>([]);
  const [saved, setSaved] = useState<SavedExam | null>(null);

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
  useEffect(() => { fetchCurrentUser().then((u) => setAdmin(!!u?.roles.includes('ADMIN'))); }, []);

  const school = useMemo(() => schools.find((s) => s.id === draft.schoolId) ?? schools[0], [schools, draft.schoolId]);
  const schoolId = school?.id;
  const set = <K extends keyof ExamDraft>(k: K, v: ExamDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  // Escola → turmas da escola (ao professor, as que lhe estão atribuídas) → disciplinas do currículo do
  // curso dessas turmas (ao professor, as que dá). O backend recusa o resto ("A teacher must choose the class they teach").
  useEffect(() => {
    if (!schoolId || admin == null) return;
    let alive = true;
    reviewChoices(Number(schoolId), !admin).then((r) => {
      if (!alive) return;
      if (!r.ok) return void toast.error(r.error);
      setChoices(r.data);
      setSubjectIds(Object.fromEntries(r.data.subjects.map((x) => [x.label, x.value])));
      // O OCR só acerta o nome da disciplina se ela estiver entre as da escola.
      setSchools((all) => all.map((x) => (x.id === schoolId ? { ...x, subjects: r.data.subjects.map((y) => y.label) } : x)));
      setDraft((d) => (d.subject && !r.data.subjects.some((y) => y.label === d.subject) ? { ...d, subject: '' } : d));
    });
    return () => { alive = false; };
  }, [schoolId, admin]);

  // Só as disciplinas do currículo da turma escolhida (ou de qualquer turma, enquanto não há turma).
  const subjectOptions = choices ? subjectChoices(choices, classId ? Number(classId) : null) : [];
  // Trocar a turma por uma que não dá a disciplina escolhida deixa-a como não escolhida (deriva-se, não se limpa num efeito):
  // assim nunca se grava um par turma+disciplina que o servidor recusa.
  const subject = !choices || subjectOptions.some((o) => o.label === draft.subject) ? draft.subject : '';
  const subjectId = subject ? subjectIds[subject] : undefined;
  const classOptions = choices ? classChoices(choices, subjectId) : [];
  // Uma turma escolhida que deixou de servir (outra escola ou disciplina) conta como não escolhida:
  // deriva-se em vez de se limpar num efeito, e o select volta a "Escolher…" porque o valor não existe.
  const chosenClassId = classOptions.some((c) => String(c.value) === classId) ? classId : '';
  const classChosen = admin === true || chosenClassId !== '';

  /**
   * `true` publica a prova, `false` deixa-a guardada à espera.
   *
   * Publicar é create → approve → visible, e a ordem não é um detalhe: o passo do
   * meio é o gate, e publicar só por visibility punha a prova à vista dos alunos
   * sem nunca o ter corrido. Se o gate chumbar a prova fica criada e oculta, e a
   * mensagem do servidor — que nomeia as questões em falta — aparece no ecrã.
   */
  async function save(publish: boolean) {
    if (!school || !subject) return;
    setSaving(true);
    const payload = {
      institutionId: Number(school.id),
      subjectId: subjectIds[subject],
      // A turma é o único âmbito que o cliente nomeia; o curso vem dela.
      // O ano letivo também: sem ele a prova não entra em nenhum ranking.
      ...(chosenClassId ? (() => {
        const chosen = classOptions.find((c) => String(c.value) === chosenClassId);
        return { classId: Number(chosenClassId), courseId: chosen?.courseId ?? null, schoolYearId: chosen?.schoolYearId ?? null };
      })() : {}),
      title: draft.title.trim() || `${draft.kind} – ${subject}`,
      examType: draft.kind,
      ...(draft.duration !== '' ? { durationMinutes: draft.duration } : {}),
      ...(draft.variant.trim() ? { variant: draft.variant.trim() } : {}),
      instructions: draft.rules.filter(Boolean).join('\n') || null,
      // O gabarito viaja no próprio pedido: `ManualStatementRequest.Option.correct` é
      // honrado na criação, por isso marcar a resposta certa não custa um segundo pedido.
      questions: toRequest(draft.items),
    };
    const res = publish ? await publishManualStatement(payload) : await createManualStatement({ ...payload, visible: false });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    setSaved({ id: Number(res.data.id), title: String(res.data.title ?? payload.title), published: publish, snapshot: JSON.stringify(draft) });
    toast.success(publish ? 'Prova publicada. Os alunos já a podem simular.' : 'Prova guardada. Fica oculta até a publicar.');
  }

  /**
   * O que o OCR leu vira rascunho. Não se guarda nada: o professor corrige aqui e só depois grava.
   * Substituir um rascunho com conteúdo pede confirmação, porque o OCR trocava tudo de uma vez.
   */
  function applyImport(extraction: ExamExtraction, names: string) {
    const imported = draftFromExtraction(extraction, { subjects: school?.subjects ?? [] });
    if (imported.items.length === 0) {
      setNotes(imported.notes);
      return void toast.error('Não foi possível ler questões nesta imagem.');
    }
    const hasContent = draft.items.some((i) => i.text.trim()) || draft.title.trim() !== '';
    if (hasContent && !window.confirm('Importar substitui as questões e o cabeçalho que já escreveu. Continuar?')) return;
    setDraft((d) => ({ ...d, ...imported.patch, items: imported.items }));
    setNotes(imported.notes);
    setSaved(null);
    setImportOpen(false);
    toast.success(`Prova lida (${names}): ${imported.items.length} questões. Reveja o que o OCR percebeu.`);
  }

  const setItem = (i: number, patch: Partial<ExamDraft['items'][number]>) => set('items', draft.items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setRule = (i: number, v: string) => set('rules', draft.rules.map((x, j) => (j === i ? v : x)));
  /** Reordena no rascunho; a ordem vai no pedido de criação, que é quem a guarda. */
  const moveItem = (i: number, direction: -1 | 1) => set('items', move(draft.items, i, direction));
  const total = totalScore(draft.items);
  const problemas = problems(draft.items);
  const ready2print = !!school && !!subject && draft.items.some((i) => i.text.trim());
  const canSave = ready2print && classChosen;
  /** Depois de guardar, gravar outra vez sem mexer em nada criava um duplicado: só volta a ser possível ao editar. */
  const unchangedSinceSave = saved !== null && saved.snapshot === JSON.stringify(draft);
  const toSave = canSave && !saving && !unchangedSinceSave;

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8 lg:p-10">
      <style>{`@media print{body *{visibility:hidden}#exam-sheet,#exam-sheet *{visibility:visible}#exam-sheet{position:absolute;left:0;top:0;width:100%;box-shadow:none}@page{size:A4;margin:10mm}}`}</style>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl leading-tight tracking-tight">Montar prova</h1>
          <p className="mt-1 text-muted-foreground">A prova segue o modelo oficial. Só o logótipo, o nome da escola e a disciplina mudam.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen((v) => !v)} aria-expanded={importOpen}>
            <ScanText aria-hidden /> Importar de imagem
          </Button>
          <Button variant="outline" onClick={() => save(false)} disabled={!toSave} title={canSave ? undefined : 'Escolha a disciplina e a turma e escreva pelo menos uma questão'}>
            <Save aria-hidden /> Guardar
          </Button>
          <Button onClick={() => save(true)} disabled={!toSave || problemas.length > 0} title={problemas.length > 0 ? 'A prova ainda não pode ser publicada' : canSave ? undefined : 'Escolha a disciplina e a turma e escreva pelo menos uma questão'}>
            {saving ? <Spinner className="size-4" /> : <Check aria-hidden />}
            Publicar
          </Button>
          <Button variant="outline" onClick={() => window.print()} disabled={!ready2print}>
            <Printer aria-hidden /> Imprimir / guardar PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 print:hidden">
          {saved && (
            <Card className="border-primary/40 bg-accent/40" role="status" aria-live="polite">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Check className="size-4 text-primary" aria-hidden />{saved.published ? 'Prova publicada' : 'Prova guardada'}</CardTitle>
                <CardDescription>
                  «{saved.title}» {saved.published ? 'já está disponível para os alunos simularem sozinhos.' : 'ficou oculta: publique-a para a poder dar a uma turma.'} A prova é dada a partir de um enunciado, numa sala: os alunos entram na sala e fazem a simulação.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {saved.published ? (
                  <Button asChild><Link href={`/exam-rooms/new?statementId=${saved.id}`}><DoorOpen aria-hidden />Criar sala com esta prova</Link></Button>
                ) : null}
                <Button asChild variant="outline"><Link href={`/statements/${saved.id}`}><FileText aria-hidden />Ver o enunciado</Link></Button>
                <Button variant="ghost" onClick={() => { if (window.confirm('Começar uma prova nova? O rascunho atual é limpo (a prova guardada não se perde).')) { setDraft({ ...EMPTY_DRAFT, schoolId: draft.schoolId }); setNotes([]); setSaved(null); } }}>
                  <Plus aria-hidden />Nova prova
                </Button>
              </CardContent>
            </Card>
          )}

          {importOpen && <ExamImporter onExtracted={applyImport} onClose={() => setImportOpen(false)} />}

          {notes.length > 0 && (
            <Card className="border-warning/40">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-warning" aria-hidden />Lido pelo OCR: reveja</CardTitle>
                    <CardDescription>O OCR errou ou ficou inseguro nestes pontos. Corrija no rascunho antes de guardar.</CardDescription>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Dispensar as notas do OCR" onClick={() => setNotes([])}><X size={16} /></Button>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="grid list-disc gap-1.5 pl-5 text-sm">{notes.map((n) => <li key={n}>{n}</li>)}</ul>
              </CardContent>
            </Card>
          )}

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
                    <NativeSelect value={subject} onChange={(e) => set('subject', e.target.value)}>
                      <option value="">Escolher…</option>
                      {subjectOptions.map((x) => <option key={x.value} value={x.label}>{x.label}</option>)}
                    </NativeSelect>
                  </Field>
                  <Field label={admin ? 'Turma (opcional)' : 'Turma'}>
                    <NativeSelect value={chosenClassId} onChange={(e) => setClassId(e.target.value)} disabled={!choices}>
                      <option value="">Escolher…</option>
                      {classOptions.map((c) => <option key={c.value} value={String(c.value)}>{c.label}</option>)}
                    </NativeSelect>
                  </Field>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Cabeçalho</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Título"><Input value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder={subject ? `${draft.kind} – ${subject}` : 'Tipo – disciplina'} /></Field>
              <div className="grid gap-4 sm:grid-cols-[1fr_1.5fr_1fr]">
                <Field label="Classe"><Input value={draft.grade} onChange={(e) => set('grade', e.target.value)} /></Field>
                <Field label="Tipo">
                  <NativeSelect value={draft.kind} onChange={(e) => set('kind', e.target.value)}>{KINDS.map((k) => <option key={k}>{k}</option>)}</NativeSelect>
                </Field>
                <Field label="Fase"><Input value={draft.phase} onChange={(e) => set('phase', e.target.value)} /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Duração (min)">
                  <Input type="number" min={1} step={5} value={draft.duration} onChange={(e) => set('duration', e.target.value === '' ? '' : Number(e.target.value))} placeholder="90" />
                </Field>
                <Field label="Série"><Input value={draft.variant} onChange={(e) => set('variant', e.target.value)} placeholder="B" /></Field>
                <Field label="Ano letivo"><Input value={draft.schoolYear} onChange={(e) => set('schoolYear', e.target.value)} placeholder="2024/2025" /></Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Questões</CardTitle>
              <CardDescription>
                Escolha o tipo de cada questão: dissertativa, escolha múltipla, verdadeiro/falso ou com alíneas (a, b, c…). Escolha múltipla e verdadeiro/falso precisam de resposta marcada para a prova poder ser publicada.
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
                  <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
                    {unscored(draft.items)} sem cotação, e sem cotação não conta para o total
                    <Button type="button" variant="outline" size="sm" onClick={() => set('items', distributeScore(draft.items, 20))}>Distribuir 20 valores</Button>
                  </span>
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

        <div className="min-w-0 overflow-x-auto lg:sticky lg:top-24">
          <ExamSheet school={school} draft={draft} />
        </div>
      </div>
    </div>
  );
}
