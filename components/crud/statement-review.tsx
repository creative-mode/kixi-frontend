'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, Eye, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { approveStatement, getStatementFull, listOptions, setStatementVisible, updateStatementReview, type ReviewQuestionInput } from '@/app/actions/crud';
import type { Row } from '@/lib/crud/entities';
import { Spinner } from '@/components/ui/spinner';
import { DetailSkeleton } from './loading';

const QUESTION_TYPES: Record<string, string> = { MULTIPLE_CHOICE: 'Escolha múltipla', TRUE_FALSE: 'Verdadeiro/falso', OPEN: 'Resposta aberta', SHORT_ANSWER: 'Resposta curta', ESSAY: 'Desenvolvimento' };
const isChoice = (t: string) => t === 'MULTIPLE_CHOICE' || t === 'TRUE_FALSE';
const isOpen = (t: string) => t === 'OPEN' || t === 'SHORT_ANSWER' || t === 'ESSAY';

type OptionDraft = { id?: number; optionLabel: string; optionText: string; isCorrect: boolean };
type QuestionDraft = { id?: number; number: number; questionType: string; text: string; maxScore: number; needsReview: boolean; modelAnswer: string; options: OptionDraft[] };
type HeaderDraft = { title: string; examType: string; variant: string; durationMinutes: string; instructions: string; subjectId: string; classId: string; schoolYearId: string; termId: string };

function toDraft(s: Row): { header: HeaderDraft; questions: QuestionDraft[] } {
  return {
    header: {
      title: s.title ?? '',
      examType: s.examType ?? '',
      variant: s.variant ?? '',
      durationMinutes: s.durationMinutes != null ? String(s.durationMinutes) : '',
      instructions: s.instructions ?? '',
      subjectId: s.subjectId != null ? String(s.subjectId) : '',
      classId: s.classId != null ? String(s.classId) : '',
      schoolYearId: s.schoolYearId != null ? String(s.schoolYearId) : '',
      termId: s.termId != null ? String(s.termId) : '',
    },
    questions: (s.questions ?? []).map((q: Row) => ({
      id: q.id,
      number: q.number,
      questionType: q.questionType,
      text: q.text ?? '',
      maxScore: Number(q.maxScore ?? 0),
      needsReview: !!q.needsReview,
      modelAnswer: q.modelAnswer ?? '',
      options: (q.options ?? []).map((o: Row) => ({ id: o.id, optionLabel: o.optionLabel, optionText: o.optionText ?? '', isCorrect: !!o.isCorrect })),
    })),
  };
}

/** Pendências do gabarito: o que falta para a prova poder ser publicada. */
export function answerKeyIssues(questions: { number: number; questionType: string; options: { isCorrect: boolean }[]; modelAnswer: string }[]): string[] {
  const out: string[] = [];
  for (const q of questions) {
    if (isChoice(q.questionType)) {
      if (!q.options.some((o) => o.isCorrect)) out.push(`Questão ${q.number} sem resposta correta marcada`);
    } else if (isOpen(q.questionType)) {
      if (!q.modelAnswer.trim()) out.push(`Questão ${q.number} sem resposta modelo`);
    }
  }
  return out;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: number; label: string }[] }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-border bg-card px-3 py-2">
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
  const [header, setHeader] = useState<HeaderDraft | null>(null);
  const [questions, setQuestions] = useState<QuestionDraft[] | null>(null);
  const [meta, setMeta] = useState<{ needsReview: boolean; visible: boolean; ocrConfidence: number | null }>({ needsReview: false, visible: false, ocrConfidence: null });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [opts, setOpts] = useState<Record<string, { value: number; label: string }[]>>({});
  const setH = (patch: Partial<HeaderDraft>) => setHeader((h) => (h ? { ...h, ...patch } : h));

  const load = useCallback(async () => {
    const r = await getStatementFull(id);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    const d = toDraft(r.data);
    setHeader(d.header);
    setQuestions(d.questions);
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
      const out: Record<string, { value: number; label: string }[]> = {};
      await Promise.all(
        (['subjects', 'classes', 'school-years', 'terms'] as const).map(async (k) => {
          const r = await listOptions(k);
          if (alive && r.ok) out[k] = r.data;
        }),
      );
      if (alive) setOpts(out);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <p className="py-12 text-center text-sm text-destructive">{error}</p>;
  if (!header || !questions) return <DetailSkeleton />;

  const issues = answerKeyIssues(questions);
  const lowConfidence = meta.ocrConfidence != null && meta.ocrConfidence < 0.9;

  async function save() {
    if (!header || !questions) return;
    setSaving(true);
    const payload = {
      title: header.title.trim(),
      examType: header.examType.trim(),
      variant: header.variant.trim() || null,
      durationMinutes: header.durationMinutes === '' ? null : Number(header.durationMinutes),
      instructions: header.instructions.trim() || null,
      subjectId: header.subjectId === '' ? null : Number(header.subjectId),
      classId: header.classId === '' ? null : Number(header.classId),
      schoolYearId: header.schoolYearId === '' ? null : Number(header.schoolYearId),
      termId: header.termId === '' ? null : Number(header.termId),
      questions: questions.map(
        (q): ReviewQuestionInput => ({
          id: q.id,
          number: q.number,
          questionType: q.questionType,
          text: q.text,
          maxScore: q.maxScore,
          needsReview: q.needsReview,
          modelAnswer: isOpen(q.questionType) ? q.modelAnswer.trim() || null : null,
          options: isChoice(q.questionType) ? q.options.map((o) => ({ id: o.id, optionLabel: o.optionLabel, optionText: o.optionText, isCorrect: o.isCorrect })) : [],
        }),
      ),
    };
    const res = await updateStatementReview(id, payload);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Revisão guardada.');
    const d = toDraft(res.data);
    setHeader(d.header);
    setQuestions(d.questions);
    setMeta((m) => ({ ...m, needsReview: !!res.data.needsReview, visible: !!res.data.visible }));
  }

  async function approveAndPublish() {
    if (issues.length > 0) {
      toast.error('Resolva as pendências do gabarito antes de publicar.');
      return;
    }
    setSaving(true);
    const a = await approveStatement(id);
    const v = a.ok ? await setStatementVisible(id, true) : a;
    setSaving(false);
    if (!v.ok) {
      toast.error(v.error ?? 'Erro');
      return;
    }
    toast.success('Prova aprovada e publicada no catálogo do aluno.');
    onExit();
  }

  const patchQ = (n: number, patch: Partial<QuestionDraft>) =>
    setQuestions((qs) => (qs ? qs.map((q) => (q.number === n ? { ...q, ...patch } : q)) : qs));

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
            <span className="text-xs text-muted-foreground">Título</span>
            <Input value={header.title} onChange={(e) => setH({ title: e.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Chave (P1, P2, Exame…)</span>
            <Input value={header.examType} onChange={(e) => setH({ examType: e.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Variante</span>
            <Input value={header.variant} onChange={(e) => setH({ variant: e.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Duração (min)</span>
            <Input type="number" min={0} value={header.durationMinutes} onChange={(e) => setH({ durationMinutes: e.target.value })} />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="text-xs text-muted-foreground">Instruções</span>
            <textarea value={header.instructions} onChange={(e) => setH({ instructions: e.target.value })} rows={2} className="rounded-md border border-border bg-card px-3 py-2" />
          </label>
          <Select label="Disciplina" value={header.subjectId} onChange={(v) => setH({ subjectId: v })} options={opts.subjects ?? []} />
          <Select label="Turma" value={header.classId} onChange={(v) => setH({ classId: v })} options={opts.classes ?? []} />
          <Select label="Ano letivo" value={header.schoolYearId} onChange={(v) => setH({ schoolYearId: v })} options={opts['school-years'] ?? []} />
          <Select label="Trimestre" value={header.termId} onChange={(v) => setH({ termId: v })} options={opts.terms ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Questões e gabarito ({questions.length})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {questions.map((q) => (
            <div key={q.number} className="rounded-lg border p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <strong>Questão {q.number}</strong>
                <Badge variant="outline">{QUESTION_TYPES[q.questionType] ?? q.questionType}</Badge>
                {q.needsReview ? <Badge variant="secondary">A rever</Badge> : null}
                <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  Cotação
                  <Input type="number" min={0} step="0.5" value={q.maxScore} onChange={(e) => patchQ(q.number, { maxScore: Number(e.target.value) })} className="w-20" />
                </label>
              </div>
              <textarea value={q.text} onChange={(e) => patchQ(q.number, { text: e.target.value })} rows={2} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" aria-label={`Texto da questão ${q.number}`} />
              {isChoice(q.questionType) ? (
                <div className="mt-3 space-y-2">
                  {q.options.map((o, k) => (
                    <div key={o.optionLabel} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${q.number}`}
                        checked={o.isCorrect}
                        onChange={() => patchQ(q.number, { options: q.options.map((x, j) => ({ ...x, isCorrect: j === k })) })}
                        aria-label={`Marcar ${o.optionLabel} como correta na questão ${q.number}`}
                        className="size-4 accent-primary"
                      />
                      <span className="w-6 text-sm font-semibold">{o.optionLabel})</span>
                      <Input value={o.optionText} onChange={(e) => patchQ(q.number, { options: q.options.map((x) => (x.optionLabel === o.optionLabel ? { ...x, optionText: e.target.value } : x)) })} aria-label={`Opção ${o.optionLabel} da questão ${q.number}`} />
                    </div>
                  ))}
                </div>
              ) : null}
              {isOpen(q.questionType) ? (
                <label className="mt-3 grid gap-1 text-sm">
                  <span className="text-xs text-muted-foreground">Resposta modelo (gabarito)</span>
                  <textarea value={q.modelAnswer} onChange={(e) => patchQ(q.number, { modelAnswer: e.target.value })} rows={2} className="rounded-md border border-border bg-card px-3 py-2" />
                </label>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" onClick={onExit} disabled={saving}>Cancelar</Button>
        <Button variant="outline" onClick={save} disabled={saving}>
          {saving ? <Spinner className="size-4" /> : <Check size={16} />}
          Guardar revisão
        </Button>
        <Button onClick={approveAndPublish} disabled={saving} title={issues.length > 0 ? 'Resolva as pendências do gabarito' : 'Aprovar e publicar no catálogo do aluno'}>
          <Eye size={16} />
          Aprovar e publicar
        </Button>
      </div>
    </div>
  );
}
