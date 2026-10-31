'use client';

import { classChoices, subjectChoices } from '@/lib/exam/curriculum';
import { displayNumber, isGroup } from '@/lib/exam/display';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, ChevronDown, ChevronUp, Eye, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  approveStatement,
  createStatementQuestion,
  deleteStatementQuestion,
  getStatementForReview,
  listStatements,
  listOptions,
  myInstitutions,
  reorderStatementQuestions,
  reviewChoices,
  saveStatementReview,
  setStatementVisible,
  type QuestionEdit,
  type ReviewChoice,
  type ReviewChoices,
  type StatementInput,
} from '@/app/actions/crud';
import { fetchCurrentUser } from '@/lib/auth';
import { answerKeyIssues, gabaritosEmFalta, sumOfScores } from '@/lib/crud/answer-key';
import type { Row } from '@/lib/crud/entities';
import { removeQuestionBlock } from '@/lib/crud/question-remove';
import { queuePlace, reviewQueue } from '@/lib/crud/review-queue';
import { statementInScope, useTeacherScope } from '@/hooks/use-teacher-scope';
import { Spinner } from '@/components/ui/spinner';
import { Confirm, type ConfirmState } from './confirm';
import { DetailSkeleton } from './loading';
import { QueueShortcuts } from './queue-shortcuts';
import { ShortcutsHint } from './shortcuts-hint';
import { QuestionImages } from './question-images';
import { MathText } from '@/student/lib/shared/math-text';
import { hasMathContent } from '@/student/lib/shared/math-content';
import { mathContentFields, mathNeedsReview, type MathContentFields } from '@/student/lib/shared/math-types';
import { useUnsavedChanges } from './use-unsaved-changes';

// O tipo tem várias grafias no backend (OCR escreve `development`, o exam builder `open`).
const QUESTION_TYPES: Record<string, string> = { MULTIPLE_CHOICE: 'Escolha múltipla', GROUP: 'Com alíneas', TRUE_FALSE: 'Verdadeiro/falso', OPEN: 'Resposta aberta', SHORT_ANSWER: 'Resposta curta', ESSAY: 'Desenvolvimento', DEVELOPMENT: 'Desenvolvimento' };
const typeLabel = (t: string | null) => (t ? QUESTION_TYPES[t.toUpperCase()] ?? t : 'Sem tipo');

type OptionDraft = { id: number; optionLabel: string; optionText: string; isCorrect: boolean };
// A cotação fica como o professor a escreve: como número, apagar o campo dava 0 e
// escrever a seguir dava "01.5".
type QuestionDraft = MathContentFields & { id: number; number: number; parentId: number | null; label: string | null; questionType: string | null; text: string; maxScore: string; needsReview: boolean; ocrReviewed: boolean; ocrConfidence: number | null; modelAnswer: string; options: OptionDraft[] };
type HeaderDraft = { institutionId: string; title: string; examType: string; variant: string; durationMinutes: string; instructions: string; totalMaxScore: string; subjectId: string; classId: string; schoolYearId: string; termId: string };
type Draft = { header: HeaderDraft; questions: QuestionDraft[] };

const str = (v: unknown) => (v != null ? String(v) : '');
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
const score = (v: string) => numOrNull(v) ?? NaN;

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
      parentId: q.parentId ?? null,
      label: q.label ?? null,
      questionType: q.questionType ?? null,
      text: q.text ?? '',
      ...mathContentFields(q),
      maxScore: str(q.maxScore ?? 0),
      needsReview: !!q.needsReview,
      ocrReviewed: !!q.ocrReviewed,
      ocrConfidence: q.ocrConfidence ?? null,
      modelAnswer: q.modelAnswer ?? '',
      options: (q.options ?? []).map((o: Row) => ({ id: Number(o.id), optionLabel: o.optionLabel, optionText: o.optionText ?? '', isCorrect: !!o.isCorrect })),
    })),
  };
}

/** O que o PUT do enunciado e o QuestionRequest/QuestionOptionRequest rejeitariam, dito antes de enviar. */
function invalid({ header, questions }: Draft, admin: boolean): string | null {
  if (!header.institutionId) return 'Escolha a escola.';
  if (!header.subjectId) return 'Escolha a disciplina.';
  if (!admin && !header.classId) return 'Escolha a turma: só o administrador grava um enunciado sem turma.';
  if (header.title.trim().length < 3) return 'O título precisa de pelo menos 3 caracteres.';
  if (!header.examType.trim()) return 'Indique a chave da prova (P1, P2, Exame…).';
  if (header.durationMinutes.trim() !== '' && !(Number(header.durationMinutes) > 0)) return 'A duração tem de ser maior que zero.';
  if (header.totalMaxScore.trim() !== '' && !(score(header.totalMaxScore) >= 0)) return 'A cotação total não é válida.';
  for (const q of questions) {
    // Uma alínea chama-se 3a, não 301: o número interno nunca é o que o professor leu na prova.
    const n = displayNumber(q, questions);
    if (!q.text.trim()) return `A questão ${n} não tem texto.`;
    if (!(score(q.maxScore) >= 0)) return `A cotação da questão ${n} não é válida.`;
    if (q.options.some((o) => !o.optionText.trim())) return `A questão ${n} tem uma opção sem texto.`;
  }
  return null;
}

function toStatementInput(h: HeaderDraft, courseId: number | null, fallbackTotal: number | null): StatementInput {
  return {
    institutionId: Number(h.institutionId),
    subjectId: Number(h.subjectId),
    title: h.title.trim(),
    examType: h.examType.trim(),
    durationMinutes: numOrNull(h.durationMinutes),
    variant: h.variant.trim() || null,
    instructions: h.instructions.trim() || null,
    // Vai sempre: o PUT grava o que receber, e omitir apagava o total (e a verificação da soma no approve).
    // Em branco, vale a soma das cotações: sem total a prova fica sem escala e fora do ranking.
    totalMaxScore: numOrNull(h.totalMaxScore) ?? fallbackTotal,
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
    if (q.text !== old.text || score(q.maxScore) !== score(old.maxScore) || q.modelAnswer !== old.modelAnswer || q.ocrReviewed !== old.ocrReviewed) {
      // O modelAnswer vai sempre com o que o servidor tem (o PUT grava-o tal e qual):
      // é por isso que tem de ter vindo de /questions, e não do /full, que não o traz.
      edit.question = {
        text: q.text.trim(), questionType: q.questionType, maxScore: score(q.maxScore), modelAnswer: q.modelAnswer.trim() || null,
        ...(q.ocrReviewed !== old.ocrReviewed ? { ocrReviewed: q.ocrReviewed } : {}),
      };
    }
    const changed = q.options.filter((o) => old.options.find((x) => x.id === o.id)?.optionText !== o.optionText);
    if (changed.length) edit.options = changed.map((o) => ({ id: o.id, optionLabel: o.optionLabel, optionText: o.optionText.trim() }));
    const correct = q.options.find((o) => o.isCorrect)?.id;
    if (correct != null && correct !== old.options.find((o) => o.isCorrect)?.id) edit.correctOptionId = correct;
    if (edit.question || edit.options || edit.correctOptionId != null) out.push(edit);
  }
  return out;
}

function Select({ label, value, onChange, options, required, disabled }: { label: string; value: string; onChange: (v: string) => void; options: ReviewChoice[]; required?: boolean; disabled?: boolean }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-xs text-muted-foreground">{label}{required ? ' *' : ''}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} required={required} disabled={disabled} className="rounded-md border border-border bg-card px-3 py-2 disabled:opacity-60">
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
  const [meta, setMeta] = useState<{ needsReview: boolean; visible: boolean; ocrConfidence: number | null }>({ needsReview: false, visible: false, ocrConfidence: null });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [schools, setSchools] = useState<ReviewChoice[]>([]);
  const [global, setGlobal] = useState<Record<string, ReviewChoice[]>>({});
  const [choices, setChoices] = useState<ReviewChoices | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const router = useRouter();
  const scope = useTeacherScope();
  /** Os enunciados por rever que este utilizador pode abrir, pela ordem da lista: dá o «seguinte» e a posição na fila. */
  const [queue, setQueue] = useState<number[] | null>(null);
  const setH = (patch: Partial<HeaderDraft>) => setHeader((h) => (h ? { ...h, ...patch } : h));
  const dirtyDraft = !!header && !!questions && !!original && JSON.stringify({ header, questions }) !== JSON.stringify(original);
  const { dialog: unsavedDialog } = useUnsavedChanges(dirtyDraft);

  /** Lê do servidor. `keep` são rascunhos de questões que falharam ao gravar: ficam por cima. */
  const load = useCallback(async (keep: QuestionDraft[] = []) => {
    const r = await getStatementForReview(id);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    const d = toDraft(r.data);
    setOriginal(d);
    setHeader(d.header);
    setQuestions(d.questions.map((q) => keep.find((k) => k.id === q.id) ?? q));
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
      const [user, mine, years, terms] = await Promise.all([fetchCurrentUser(), myInstitutions(), listOptions('school-years'), listOptions('terms')]);
      if (!alive) return;
      setAdmin(!!user?.roles.includes('ADMIN'));
      if (mine.ok) setSchools(mine.data.map((i) => ({ value: Number(i.id), label: i.name ?? i.code })));
      setGlobal({ 'school-years': years.ok ? years.data : [], terms: terms.ok ? terms.data : [] });
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Disciplinas e turmas dependem da escola (e, ao professor, das suas atribuições).
  const institutionId = header?.institutionId ?? '';
  useEffect(() => {
    if (!institutionId || admin == null) return;
    let alive = true;
    reviewChoices(Number(institutionId), !admin).then((r) => {
      if (!alive) return;
      if (!r.ok) return void toast.error(r.error);
      setChoices(r.data);
      // O que vinha do OCR ou de outra escola e aqui não se pode escolher fica em branco,
      // em vez de um select a mostrar "—" com um valor escondido que o servidor recusaria.
      setHeader((h) => {
        if (!h) return h;
        const classId = r.data.classes.some((x) => String(x.value) === h.classId) ? h.classId : '';
        const subjectId = subjectChoices(r.data, classId ? Number(classId) : null).some((x) => String(x.value) === h.subjectId) ? h.subjectId : '';
        return { ...h, subjectId, classId };
      });
    });
    return () => {
      alive = false;
      setChoices(null);
    };
  }, [institutionId, admin]);

  useEffect(() => {
    if (!scope) return;
    let alive = true;
    listStatements('review').then((res) => {
      if (alive) setQueue(res.ok ? reviewQueue(res.data.filter((r) => statementInScope(scope, r))) : []);
    });
    return () => {
      alive = false;
    };
  }, [scope]);

  if (error) return <p className="py-12 text-center text-sm text-destructive">{error}</p>;
  if (!header || !questions || !original || admin == null) return <DetailSkeleton />;

  // Disciplinas do currículo da turma escolhida (ou de qualquer turma sem turma); ao professor, só as que dá.
  const subjects = choices ? subjectChoices(choices, header.classId ? Number(header.classId) : null) : [];
  const classes = choices ? classChoices(choices, header.subjectId ? Number(header.subjectId) : null) : [];
  const courseId = choices?.classes.find((c) => c.value === Number(header.classId))?.courseId ?? null;

  const issues = answerKeyIssues(questions.map((q) => ({ ...q, maxScore: score(q.maxScore) })), numOrNull(header.totalMaxScore));
  // Aviso, não pendência: aprova-se sem gabarito, mas o SchoolOps não corrige a questão e a simulação do aluno fica sem nota nela.
  const semGabarito = gabaritosEmFalta(questions.map((q) => ({ ...q, maxScore: score(q.maxScore) })));
  const lowConfidence = meta.ocrConfidence != null && meta.ocrConfidence < 0.9;
  const dirty = dirtyDraft;

  /** Grava e recarrega do servidor. Devolve se tudo ficou gravado. */
  async function save(): Promise<boolean> {
    if (!header || !questions || !original) return false;
    // O curso vem da turma: sem as turmas carregadas, o PUT apagava-o.
    if (header.institutionId && !choices) {
      toast.error('Ainda a carregar as turmas da escola. Tente daqui a pouco.');
      return false;
    }
    const problem = invalid({ header, questions }, !!admin);
    if (problem) {
      toast.error(problem);
      return false;
    }
    setSaving(true);
    // Uma ação que nem chega ao servidor (página de uma versão anterior, rede em baixo) lança em vez de devolver
    // `ok: false`: sem isto o botão ficava a rodar e nada era dito.
    const res = await saveStatementReview(id, toStatementInput(header, courseId, sumOfScores(questions.map((q) => ({ maxScore: score(q.maxScore) })))), questionEdits(original.questions, questions)).catch(() => null);
    if (!res) {
      setSaving(false);
      toast.error('Não foi possível gravar: a página pode ser de uma versão anterior ou a ligação falhou. Recarregue e tente de novo.');
      return false;
    }
    if (!res.ok) {
      setSaving(false);
      toast.error(res.error);
      return false;
    }
    // O que falhou continua no ecrã por gravar; o resto vem como ficou no servidor.
    const failedIds = new Set(res.data.failed.map((f) => f.id));
    await load(questions.filter((q) => failedIds.has(q.id)));
    setSaving(false);
    if (res.data.failed.length) {
      toast.error(`Algumas questões não foram gravadas: ${res.data.failed.map((f) => f.error).join(' · ')}`);
      return false;
    }
    toast.success('Revisão guardada.');
    return true;
  }

  const place = queue ? queuePlace(queue, id) : null;
  const nextId = place?.next ?? null;

  /** `goNext`: depois de publicar, abre-se logo o seguinte da fila (já em revisão) em vez de voltar ao detalhe. */
  async function approveAndPublish(goNext: boolean) {
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
    if (goNext && nextId !== null) return router.push(`/statements/${nextId}?rever=1`);
    if (goNext) toast.message('Não há mais enunciados por rever.');
    onExit();
  }

  /** Andar pela fila sem aprovar: sair de uma revisão por gravar pergunta primeiro, como o «Voltar». */
  function goTo(target: number) {
    const open = () => router.push(`/statements/${target}?rever=1`);
    if (!dirty) return open();
    setConfirm({
      title: 'Sair sem gravar?',
      description: 'As alterações que fez nesta revisão perdem-se.',
      action: 'Sair sem gravar',
      destructive: true,
      run: open,
    });
  }

  /** O atalho «A» não aprova de imediato: abre a confirmação, como um clique deliberado no botão. */
  function askApprove() {
    if (issues.length > 0) return void toast.error('Resolva as pendências do gabarito antes de publicar.');
    const next = nextId !== null;
    setConfirm({
      title: next ? 'Aprovar e passar ao seguinte?' : 'Aprovar e publicar?',
      description: `«${header?.title ?? ''}» fica aprovado e publicado no catálogo do aluno.${next ? ' Abre-se depois o seguinte da fila.' : ''}`,
      action: next ? 'Aprovar e seguinte' : 'Aprovar e publicar',
      run: () => approveAndPublish(next),
    });
  }

  function leave() {
    if (!dirty) return onExit();
    setConfirm({
      title: 'Sair sem gravar?',
      description: 'As alterações que fez nesta revisão perdem-se.',
      action: 'Sair sem gravar',
      destructive: true,
      run: onExit,
    });
  }

  const patchQ = (qid: number, patch: Partial<QuestionDraft>) =>
    setQuestions((qs) => (qs ? qs.map((q) => (q.id === qid ? { ...q, ...patch } : q)) : qs));

  /**
   * Guarda primeiro quando há rascunho: adicionar/remover/mover recarrega do
   * servidor, e sem isto deitava fora texto, cotação ou resposta modelo ainda
   * por gravar (#170 review). O save valida e mostra o problema; se falhar, a
   * mutação nem começa.
   */
  async function ensureSaved(): Promise<boolean> {
    if (!dirty) return true;
    return save();
  }

  /** Blocos para mover/remover em conjunto: questão de topo mais as alíneas que
   *  a seguem. Sem isto, mover um grupo partia-o e remover um pai deixava as
   *  alíneas ativas sem pai. */
  function blocksOf(qs: QuestionDraft[]): QuestionDraft[][] {
    const out: QuestionDraft[][] = [];
    for (const q of qs) {
      const last = out[out.length - 1];
      if (q.parentId != null && last) last.push(q);
      else out.push([q]);
    }
    return out;
  }

  /** #165: cria a pergunta no servidor (number/orderIndex vêm de lá) e recarrega. */
  async function addQuestion() {
    if (!questions || !(await ensureSaved())) return;
    setSaving(true);
    const res = await createStatementQuestion(id, { text: 'Nova questão', questionType: 'open', maxScore: 0, modelAnswer: null });
    if (!res.ok) {
      setSaving(false);
      toast.error(res.error);
      return;
    }
    await load();
    setSaving(false);
    toast.success('Questão adicionada. Edite o texto e a cotação.');
  }

  function removeQuestion(q: QuestionDraft) {
    const all = questions ?? [];
    const kids = all.filter((x) => x.parentId === q.id);
    const label = `${q.parentId != null ? 'a alínea' : 'a questão'} ${displayNumber(q, all)}`;
    setConfirm({
      title: `Remover ${label}?`,
      description: kids.length
        ? `As ${kids.length} alíneas saem junto — não ficam ativas sem pai. As imagens que tenham ficam órfãs.`
        : 'A questão sai do enunciado. As imagens que tenha ficam órfãs.',
      action: 'Remover',
      destructive: true,
      run: async () => {
        if (!(await ensureSaved())) return;
        setSaving(true);
        const targets = [q, ...kids];
        const res = await removeQuestionBlock(
          targets.map((t) => t.id),
          async (qid) => {
            const r = await deleteStatementQuestion(id, qid);
            return r.ok ? { ok: true } : { ok: false, error: r.error };
          },
        );
        await load();
        setSaving(false);
        if (!res.ok) {
          // Parcial: o que saiu está no servidor e o que falhou continua no
          // ecrã — sem toast de sucesso, para a UI nunca mentir (#170 review).
          toast.error(
            res.removed.length > 0
              ? `Remoção parcial: ${res.removed.length} de ${targets.length} saíram. ${res.error} Tente de novo a restante.`
              : `Nada foi removido. ${res.error}`,
          );
          return;
        }
        toast.success('Questão removida.');
      },
    });
  }

  /** #165: sobe/desce o bloco (questão + alíneas); só orderIndex mexe. */
  async function moveBlock(bi: number, dir: -1 | 1) {
    if (!questions || !(await ensureSaved())) return;
    const blks = blocksOf(questions);
    const other = bi + dir;
    if (other < 0 || other >= blks.length) return;
    [blks[bi], blks[other]] = [blks[other], blks[bi]];
    setSaving(true);
    const res = await reorderStatementQuestions(id, blks.flat().map((qq) => qq.id));
    if (!res.ok) toast.error(res.error);
    await load();
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={leave}>
          <ArrowLeft size={14} /> Voltar
        </Button>
        <h1 className="text-xl font-bold tracking-tight">Rever enunciado</h1>
        {place?.position ? <p className="text-sm text-muted-foreground">Fila de revisão: {place.position} de {place.total}</p> : null}
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

      {semGabarito.length > 0 ? (
        <Card className="border-border bg-muted/40" data-testid="gestor-statements-sem-gabarito">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-semibold">
                {semGabarito.length === 1 ? '1 questão aberta sem gabarito' : `${semGabarito.length} questões abertas sem gabarito`}
              </p>
              <p className="mt-1 text-muted-foreground">
                Pode publicar na mesma, mas sem gabarito a correção automática não corrige{semGabarito.length === 1 ? ' esta questão' : ' estas questões'} e a nota da simulação do aluno fica por dar.
                Escreva a resposta modelo (e, se quiser, os critérios depois de «Critérios:») em: {semGabarito.map((q) => `Questão ${displayNumber(q, questions)}`).join(', ')}.
              </p>
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
            <Input inputMode="decimal" value={header.totalMaxScore} onChange={(e) => setH({ totalMaxScore: e.target.value })} />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="text-xs text-muted-foreground">Instruções</span>
            <textarea value={header.instructions} onChange={(e) => setH({ instructions: e.target.value })} rows={2} className="rounded-md border border-border bg-card px-3 py-2" />
          </label>
          {/* Mudar de escola muda as disciplinas e turmas possíveis: as escolhidas deixam de valer. */}
          <Select label="Escola" required value={header.institutionId} onChange={(v) => setH({ institutionId: v, subjectId: '', classId: '' })} options={schools} />
          <Select label="Turma" required={!admin} value={header.classId} onChange={(v) => setH({ classId: v })} options={classes} disabled={!choices} />
          <Select label="Disciplina" required value={header.subjectId} onChange={(v) => setH({ subjectId: v })} options={subjects} disabled={!choices} />
          <Select label="Ano letivo" value={header.schoolYearId} onChange={(v) => setH({ schoolYearId: v })} options={global['school-years'] ?? []} />
          <Select label="Trimestre" value={header.termId} onChange={(v) => setH({ termId: v })} options={global.terms ?? []} />
          {!admin && choices && classes.length === 0 ? (
            <p className="text-xs text-warning sm:col-span-2">Não tem turmas atribuídas nesta escola. Peça ao administrador uma atribuição de turma e disciplina.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Questões e gabarito ({questions.length})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {blocksOf(questions).map((blk, bi, arr) => blk.map((q) => (
            <div key={q.id} className={`rounded-lg border p-4 ${q.parentId != null ? 'ml-6 border-dashed' : ''}`}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <strong>{q.parentId != null ? 'Alínea' : 'Questão'} {displayNumber(q, questions)}</strong>
                <Badge variant="outline">{typeLabel(q.questionType)}</Badge>
                {q.needsReview ? <Badge variant="secondary">OCR a rever</Badge> : null}
                {q.ocrConfidence != null && q.ocrConfidence < 0.9 ? (
                  <Badge variant="secondary">Confiança OCR baixa ({Math.round(q.ocrConfidence * 100)}%)</Badge>
                ) : null}
                {mathNeedsReview(q.formulas, q.blocks) ? <Badge variant="warning">Fórmula a rever</Badge> : null}
                {(q.needsReview || mathNeedsReview(q.formulas, q.blocks)) && !q.ocrReviewed ? (
                  <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => patchQ(q.id, { ocrReviewed: true })}>
                    <Check size={14} /> Marcar OCR revisto
                  </Button>
                ) : null}
                {isGroup(q) ? (
                  <span className="ml-auto text-xs text-muted-foreground">Vale a soma das alíneas</span>
                ) : (
                  <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                    Cotação
                    <Input inputMode="decimal" value={q.maxScore} onChange={(e) => patchQ(q.id, { maxScore: e.target.value })} className="w-20" aria-label={`Cotação da questão ${displayNumber(q, questions)}`} />
                  </label>
                )}
                <span className="flex items-center gap-1">
                  {blk[0] === q ? (
                    <>
                      <Button type="button" size="icon" variant="ghost" className="size-7" disabled={saving || bi === 0} aria-label={`Subir questão ${displayNumber(q, questions)}`} onClick={() => void moveBlock(bi, -1)}><ChevronUp size={14} /></Button>
                      <Button type="button" size="icon" variant="ghost" className="size-7" disabled={saving || bi === arr.length - 1} aria-label={`Descer questão ${displayNumber(q, questions)}`} onClick={() => void moveBlock(bi, 1)}><ChevronDown size={14} /></Button>
                    </>
                  ) : null}
                  <Button type="button" size="icon" variant="ghost" className="size-7 hover:bg-danger-soft hover:text-destructive" disabled={saving} aria-label={`Remover questão ${displayNumber(q, questions)}`} onClick={() => removeQuestion(q)}><Trash2 size={14} /></Button>
                </span>
              </div>
              <textarea value={q.text} onChange={(e) => patchQ(q.id, { text: e.target.value, blocks: undefined })} rows={2} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" aria-label={`Texto da questão ${displayNumber(q, questions)}`} />
              {hasMathContent(q.text, q.formulas, q.blocks) ? (
                <div className="mt-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm" aria-label={`Pré-visualização matemática da questão ${displayNumber(q, questions)}`}>
                  <MathText text={q.text} formulas={q.formulas} blocks={q.blocks} />
                  {q.rawText && q.rawText !== q.text ? <details className="mt-2 text-xs text-muted-foreground"><summary>Texto OCR original</summary><p className="mt-1 whitespace-pre-wrap">{q.rawText}</p></details> : null}
                  {q.formulas?.map((formula, index) => <span key={index} className="sr-only">Fórmula OCR: {formula.raw}; confiança {formula.confidence == null ? 'indisponível' : `${Math.round(formula.confidence * 100)}%`}</span>)}
                </div>
              ) : null}
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
                        aria-label={`Marcar ${o.optionLabel} como correta na questão ${displayNumber(q, questions)}`}
                        className="size-4 accent-primary"
                      />
                      <span className="w-6 text-sm font-semibold">{o.optionLabel})</span>
                      <Input value={o.optionText} onChange={(e) => patchQ(q.id, { options: q.options.map((x) => (x.id === o.id ? { ...x, optionText: e.target.value } : x)) })} aria-label={`Opção ${o.optionLabel} da questão ${displayNumber(q, questions)}`} />
                    </div>
                  ))}
                </div>
              ) : (
                <label className="mt-3 grid gap-1 text-sm">
                  <span className="text-xs text-muted-foreground">Resposta modelo (opcional)</span>
                  <textarea value={q.modelAnswer} onChange={(e) => patchQ(q.id, { modelAnswer: e.target.value })} rows={2} className="rounded-md border border-border bg-card px-3 py-2" />
                </label>
              )}
              {/* #165: o mesmo controlo da vista de leitura — anexar figuras DURANTE a revisão.
                  Grava de imediato (POST /api/v1/question-images), independente do Guardar revisão. */}
              {q.id > 0 ? <QuestionImages questionId={q.id} /> : null}
            </div>
          )))}
          <Button type="button" variant="outline" onClick={() => void addQuestion()} disabled={saving}>
            <Plus size={16} aria-hidden /> Adicionar questão
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" onClick={leave} disabled={saving}>Cancelar</Button>
        <Button variant="outline" onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? <Spinner className="size-4" /> : <Check size={16} />}
          Guardar revisão
        </Button>
        <Button variant={nextId !== null ? 'outline' : 'default'} onClick={() => void approveAndPublish(false)} disabled={saving} aria-keyshortcuts={nextId === null ? 'A' : undefined} data-testid="gestor-statements-publicar" title={issues.length > 0 ? 'Resolva as pendências do gabarito' : dirty ? 'Guarda as alterações, aprova e publica no catálogo do aluno' : 'Aprovar e publicar no catálogo do aluno'}>
          <Eye size={16} />
          {dirty ? 'Guardar, aprovar e publicar' : 'Aprovar e publicar'}
        </Button>
        {nextId !== null ? (
          <Button onClick={() => void approveAndPublish(true)} disabled={saving} aria-keyshortcuts="A" data-testid="gestor-statements-publicar-seguinte">
            <Eye size={16} />
            {dirty ? 'Guardar, aprovar e ir para o seguinte' : 'Aprovar e ir para o seguinte'}
          </Button>
        ) : null}
      </div>
      <ShortcutsHint items={[...(place && place.total > 1 ? [{ keys: ['K', 'J'], label: 'anterior / seguinte da fila' }] : []), { keys: ['A'], label: nextId !== null ? 'aprovar e ir para o seguinte' : 'aprovar e publicar' }]} />
      <QueueShortcuts
        handlers={{
          j: () => (place?.following != null ? goTo(place.following) : toast.message('Este é o último da fila.')),
          k: () => (place?.previous != null ? goTo(place.previous) : toast.message('Este é o primeiro da fila.')),
          a: askApprove,
        }}
        enabled={!saving}
      />
      <Confirm state={confirm} onClose={() => setConfirm(null)} />
      {unsavedDialog}
    </div>
  );
}
