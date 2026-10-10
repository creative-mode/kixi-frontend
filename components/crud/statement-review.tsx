'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, Eye, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { approveStatement, getStatementFull, listOptions, myInstitutions, saveStatementReview, setStatementVisible, type QuestionEdit, type StatementInput } from '@/app/actions/crud';
import { answerKeyIssues } from '@/lib/crud/answer-key';
import type { Row } from '@/lib/crud/entities';
import { Spinner } from '@/components/ui/spinner';
import { DetailSkeleton } from './loading';

// O tipo tem várias grafias no backend (OCR escreve `development`, o exam builder `open`).
const QUESTION_TYPES: Record<string, string> = { MULTIPLE_CHOICE: 'Escolha múltipla', TRUE_FALSE: 'Verdadeiro/falso', OPEN: 'Resposta aberta', SHORT_ANSWER: 'Resposta curta', ESSAY: 'Desenvolvimento', DEVELOPMENT: 'Desenvolvimento' };
const typeLabel = (t: string | null) => (t ? QUESTION_TYPES[t.toUpperCase()] ?? t : 'Sem tipo');

type OptionDraft = { id: number; optionLabel: string; optionText: string; isCorrect: boolean };
type QuestionDraft = { id: number; number: number; questionType: string | null; text: string; maxScore: number; needsReview: boolean; modelAnswer: string; options: OptionDraft[] };
type HeaderDraft = { institutionId: string; title: string; examType: string; variant: string; durationMinutes: string; instructions: string; totalMaxScore: string; subjectId: string; classId: string; schoolYearId: string; termId: string };
type Draft = { header: HeaderDraft; questions: QuestionDraft[] };
type Choice = { value: number; label: string };

const str = (v: unknown) => (v != null ? String(v) : '');
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

function toDraft(s: Row): Draft {
  return {
    header: {
      institutionId: str(s.institutionId),
      title: s.title ?? '',
      examType: s.examType ?? '',
      variant: s.variant ?? '',
      durationMinutes: str(s.durationMinutes),
      instructions: s.instructions ?? '',
      totalMaxScore: str(s.totalMaxScore),
      subjectId: str(s.subjectId),
      classId: str(s.classId),
      schoolYearId: str(s.schoolYearId),
      termId: str(s.termId),
    },
    questions: (s.questions ?? []).map((q: Row) => ({
      id: Number(q.id),
      number: q.number,
      questionType: q.questionType ?? null,
      text: q.text ?? '',
      maxScore: Number(q.maxScore ?? 0),
      needsReview: !!q.needsReview,
      modelAnswer: q.modelAnswer ?? '',
      options: (q.options ?? []).map((o: Row) => ({ id: Number(o.id), optionLabel: o.optionLabel, optionText: o.optionText ?? '', isCorrect: !!o.isCorrect })),
    })),
  };
}

/** O que o PUT do enunciado e o QuestionRequest/QuestionOptionRequest rejeitariam, dito antes de enviar. */
function invalid({ header, questions }: Draft): string | null {
  if (!header.institutionId) return 'Escolha a escola.';
  if (!header.subjectId) return 'Escolha a disciplina.';
  if (header.title.trim().length < 3) return 'O título precisa de pelo menos 3 caracteres.';
  if (!header.examType.trim()) return 'Indique a chave da prova (P1, P2, Exame…).';
  if (header.durationMinutes.trim() !== '' && !(Number(header.durationMinutes) > 0)) return 'A duração tem de ser maior que zero.';
  if (header.totalMaxScore.trim() !== '' && !(Number(header.totalMaxScore) >= 0)) return 'A cotação total não pode ser negativa.';
  for (const q of questions) {
    if (!q.text.trim()) return `A questão ${q.number} não tem texto.`;
    if (!Number.isFinite(q.maxScore) || q.maxScore < 0) return `A cotação da questão ${q.number} não é válida.`;
    if (q.options.some((o) => !o.optionText.trim())) return `A questão ${q.number} tem uma opção sem texto.`;
  }
  return null;
}

function toStatementInput(h: HeaderDraft, courseId: number | null): StatementInput {
  return {
    institutionId: Number(h.institutionId),
    subjectId: Number(h.subjectId),
    title: h.title.trim(),
    examType: h.examType.trim(),
    durationMinutes: numOrNull(h.durationMinutes),
    variant: h.variant.trim() || null,
    instructions: h.instructions.trim() || null,
    // Vai sempre: o PUT grava o que receber, e omitir apagava o total (e a verificação da soma no approve).
    totalMaxScore: numOrNull(h.totalMaxScore),
    schoolYearId: numOrNull(h.schoolYearId),
    termId: numOrNull(h.termId),
    classId: numOrNull(h.classId),
    courseId,
  };
}

/** Só o que mudou em relação ao que veio do servidor: cada parte é um pedido. */
function questionEdits(before: QuestionDraft[], after: QuestionDraft[]): QuestionEdit[] {
  const out: QuestionEdit[] = [];
  for (const q of after) {
    const old = before.find((x) => x.id === q.id);
    if (!old) continue;
    const edit: QuestionEdit = { id: q.id, number: q.number };
    if (q.text !== old.text || q.maxScore !== old.maxScore || q.modelAnswer !== old.modelAnswer) {
      edit.question = { text: q.text.trim(), questionType: q.questionType, maxScore: q.maxScore, modelAnswer: q.modelAnswer.trim() || null };
    }
    const changed = q.options.filter((o) => old.options.find((x) => x.id === o.id)?.optionText !== o.optionText);
    if (changed.length) edit.options = changed.map((o) => ({ id: o.id, optionLabel: o.optionLabel, optionText: o.optionText.trim() }));
    const correct = q.options.find((o) => o.isCorrect)?.id;
    if (correct != null && correct !== old.options.find((o) => o.isCorrect)?.id) edit.correctOptionId = correct;
    if (edit.question || edit.options || edit.correctOptionId != null) out.push(edit);
  }
  return out;
}

function Select({ label, value, onChange, options, required }: { label: string; value: string; onChange: (v: string) => void; options: Choice[]; required?: boolean }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-xs text-muted-foreground">{label}{required ? ' *' : ''}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} required={required} className="rounded-md border border-border bg-card px-3 py-2">
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/** FE-11: rever cabeçalho, questões e gabarito; aprovar e publicar. */
export function StatementReview({ id, onExit }: { id: number; onExit: () => void }) {
  const [original, setOriginal] = useState<Draft | null>(null);
  const [header, setHeader] = useState<HeaderDraft | null>(null);
  const [questions, setQuestions] = useState<QuestionDraft[] | null>(null);
  const [courseId, setCourseId] = useState<number | null>(null);
  const [meta, setMeta] = useState<{ needsReview: boolean; visible: boolean; ocrConfidence: number | null }>({ needsReview: false, visible: false, ocrConfidence: null });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [opts, setOpts] = useState<Record<string, Choice[]>>({});
  const setH = (patch: Partial<HeaderDraft>) => setHeader((h) => (h ? { ...h, ...patch } : h));

  const load = useCallback(async () => {
    const r = await getStatementFull(id);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    const d = toDraft(r.data);
    setOriginal(d);
    setHeader(d.header);
    setQuestions(d.questions);
    setCourseId(r.data.courseId ?? null);
    setMeta({ needsReview: !!r.data.needsReview, visible: !!r.data.visible, ocrConfidence: r.data.ocrConfidence ?? null });
  }, [id]);

  useEffect(() => {
    const task = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(task);
  }, [load]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Record<string, Choice[]> = {};
      await Promise.all([
        ...(['subjects', 'classes', 'school-years', 'terms'] as const).map(async (k) => {
          const r = await listOptions(k);
          if (r.ok) out[k] = r.data;
        }),
        myInstitutions().then((r) => {
          if (r.ok) out.institutions = r.data.map((i) => ({ value: Number(i.id), label: i.name ?? i.code }));
        }),
      ]);
      if (alive) setOpts(out);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <p className="py-12 text-center text-sm text-destructive">{error}</p>;
  if (!header || !questions || !original) return <DetailSkeleton />;

  const issues = answerKeyIssues(questions, numOrNull(header.totalMaxScore));
  const lowConfidence = meta.ocrConfidence != null && meta.ocrConfidence < 0.9;
  const dirty = JSON.stringify({ header, questions }) !== JSON.stringify(original);

  /** Grava e recarrega do servidor. Devolve se tudo ficou gravado. */
  async function save(): Promise<boolean> {
    if (!header || !questions || !original) return false;
    const problem = invalid({ header, questions });
    if (problem) {
      toast.error(problem);
      return false;
    }
    setSaving(true);
    const res = await saveStatementReview(id, toStatementInput(header, courseId), questionEdits(original.questions, questions));
    if (!res.ok) {
      setSaving(false);
      toast.error(res.error);
      return false;
    }
    await load();
    setSaving(false);
    if (res.data.failed.length) {
      toast.error(`Algumas questões não foram gravadas: ${res.data.failed.join(' · ')}`);
      return false;
    }
    toast.success('Revisão guardada.');
    return true;
  }

  async function approveAndPublish() {
    if (issues.length > 0) {
      toast.error('Resolva as pendências do gabarito antes de publicar.');
      return;
    }
    // O que está no ecrã é o que o professor está a aprovar: grava primeiro.
    if (dirty && !(await save())) return;
    setSaving(true);
    const a = await approveStatement(id);
    if (!a.ok) {
      setSaving(false);
      toast.error(`Não foi aprovada: ${a.error}`);
      return;
    }
    const v = await setStatementVisible(id, true);
    setSaving(false);
    if (!v.ok) {
      // São dois pedidos: o approve já passou, por isso a prova fica aprovada e oculta.
      setMeta((m) => ({ ...m, needsReview: false }));
      toast.error(`A prova foi aprovada, mas continua oculta: ${v.error}. Tente publicar de novo.`);
      return;
    }
    toast.success('Prova aprovada e publicada no catálogo do aluno.');
    onExit();
  }

  const patchQ = (qid: number, patch: Partial<QuestionDraft>) =>
    setQuestions((qs) => (qs ? qs.map((q) => (q.id === qid ? { ...q, ...patch } : q)) : qs));

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onExit}>
          <ArrowLeft size={14} /> Voltar
        </Button>
        <h1 className="text-xl font-bold tracking-tight">Rever enunciado</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          {meta.needsReview ? <Badge variant="secondary">A rever</Badge> : <Badge variant="default">Revista</Badge>}
          {meta.visible ? <Badge variant="default">Publicada</Badge> : <Badge variant="outline">Oculta</Badge>}
          {lowConfidence ? <Badge variant="secondary">Confiança OCR baixa ({Math.round((meta.ocrConfidence ?? 0) * 100)}%)</Badge> : null}
        </div>
      </div>

      {issues.length > 0 ? (
        <Card className="border-warning/40 bg-warning-soft">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warning" />
            <div>
              <p className="font-semibold text-warning">Pendências do gabarito ({issues.length})</p>
              <ul className="mt-1 list-disc pl-5 text-warning">
                {issues.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle className="text-base">Cabeçalho e vinculação</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="text-xs text-muted-foreground">Título *</span>
            <Input value={header.title} onChange={(e) => setH({ title: e.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Chave (P1, P2, Exame…) *</span>
            <Input value={header.examType} onChange={(e) => setH({ examType: e.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Variante</span>
            <Input value={header.variant} onChange={(e) => setH({ variant: e.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Duração (min)</span>
            <Input type="number" min={1} value={header.durationMinutes} onChange={(e) => setH({ durationMinutes: e.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Cotação total</span>
            <Input type="number" min={0} step="0.5" value={header.totalMaxScore} onChange={(e) => setH({ totalMaxScore: e.target.value })} />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="text-xs text-muted-foreground">Instruções</span>
            <textarea value={header.instructions} onChange={(e) => setH({ instructions: e.target.value })} rows={2} className="rounded-md border border-border bg-card px-3 py-2" />
          </label>
          <Select label="Escola" required value={header.institutionId} onChange={(v) => setH({ institutionId: v })} options={opts.institutions ?? []} />
          <Select label="Disciplina" required value={header.subjectId} onChange={(v) => setH({ subjectId: v })} options={opts.subjects ?? []} />
          <Select label="Turma" value={header.classId} onChange={(v) => setH({ classId: v })} options={opts.classes ?? []} />
          <Select label="Ano letivo" value={header.schoolYearId} onChange={(v) => setH({ schoolYearId: v })} options={opts['school-years'] ?? []} />
          <Select label="Trimestre" value={header.termId} onChange={(v) => setH({ termId: v })} options={opts.terms ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Questões e gabarito ({questions.length})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {questions.map((q) => (
            <div key={q.id} className="rounded-lg border p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <strong>Questão {q.number}</strong>
                <Badge variant="outline">{typeLabel(q.questionType)}</Badge>
                {q.needsReview ? <Badge variant="secondary">A rever</Badge> : null}
                <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  Cotação
                  <Input type="number" min={0} step="0.5" value={q.maxScore} onChange={(e) => patchQ(q.id, { maxScore: Number(e.target.value) })} className="w-20" />
                </label>
              </div>
              <textarea value={q.text} onChange={(e) => patchQ(q.id, { text: e.target.value })} rows={2} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" aria-label={`Texto da questão ${q.number}`} />
              {/* Como o servidor: é ter opções que faz a questão precisar de resposta correta, não o tipo. */}
              {q.options.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {q.options.map((o) => (
                    <div key={o.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${q.id}`}
                        checked={o.isCorrect}
                        onChange={() => patchQ(q.id, { options: q.options.map((x) => ({ ...x, isCorrect: x.id === o.id })) })}
                        aria-label={`Marcar ${o.optionLabel} como correta na questão ${q.number}`}
                        className="size-4 accent-primary"
                      />
                      <span className="w-6 text-sm font-semibold">{o.optionLabel})</span>
                      <Input value={o.optionText} onChange={(e) => patchQ(q.id, { options: q.options.map((x) => (x.id === o.id ? { ...x, optionText: e.target.value } : x)) })} aria-label={`Opção ${o.optionLabel} da questão ${q.number}`} />
                    </div>
                  ))}
                </div>
              ) : (
                <label className="mt-3 grid gap-1 text-sm">
                  <span className="text-xs text-muted-foreground">Resposta modelo (opcional)</span>
                  <textarea value={q.modelAnswer} onChange={(e) => patchQ(q.id, { modelAnswer: e.target.value })} rows={2} className="rounded-md border border-border bg-card px-3 py-2" />
                </label>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" onClick={onExit} disabled={saving}>Cancelar</Button>
        <Button variant="outline" onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? <Spinner className="size-4" /> : <Check size={16} />}
          Guardar revisão
        </Button>
        <Button onClick={approveAndPublish} disabled={saving} title={issues.length > 0 ? 'Resolva as pendências do gabarito' : dirty ? 'Guarda as alterações, aprova e publica no catálogo do aluno' : 'Aprovar e publicar no catálogo do aluno'}>
          <Eye size={16} />
          {dirty ? 'Guardar, aprovar e publicar' : 'Aprovar e publicar'}
        </Button>
      </div>
    </div>
  );
}
