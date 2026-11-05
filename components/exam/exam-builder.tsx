'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, DoorOpen, FileText, Gift, Plus, Printer, Save, ScanText, Sparkles, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { reportActionError } from '@/lib/notify-session-expired';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import Link from 'next/link';
import { approveStatement, createManualStatement, getStatementForReview, getStatementFull, myInstitutions, publishManualStatement, reviewChoices, setStatementVisible, updateManualStatement, type ReviewChoices, type StatementInput } from '@/app/actions/crud';
import { extractDonation, getDonation, linkDonationStatement } from '@/app/actions/donations';
import type { DonationDetail } from '@/lib/donations/model';
import { fetchCurrentUser } from '@/lib/auth';
import { classChoices, subjectChoices } from '@/lib/exam/curriculum';
import { clearDraft, draftHasContent, EMPTY_DRAFT, KINDS, loadDraft, saveDraft, type ExamDraft, type School } from '@/lib/exam/schools';
import { listQuestionImages, uploadQuestionImage } from '@/app/actions/media';
import { applyServerIds, applyUpdateIdentities, distributeScore, figuresOf, move, problemDetails, toRequest, toUpdateRequest, totalScore, unscored } from '@/lib/exam/draft';
import { renderPdfPageToImage, pdfPageCount } from '@/lib/exam/pdf';
import { mergePageRetry } from '@/lib/exam/retry';
import { flattenSourcePages, pageAtSources } from '@/lib/exam/sources';
import { streamExamOcr } from '@/lib/exam/ocr-stream';
import { missingToSave, readinessParts, saveBlocker } from '@/lib/exam/readiness';
import { cn } from '@/lib/utils';
import { draftFromExtraction, type ExamExtraction, type ImportedNote } from '@/lib/exam/extraction';
import type { OriginalPage } from './exam-importer';
import { ExamImporter } from './exam-importer';
import { ExamSheet } from './exam-sheet';
import { QuestionEditor } from './question-editor';
import { SourceThumb } from './source-thumb';
import { Confirm, type ConfirmState } from '@/components/crud/confirm';
import { useUnsavedChanges } from '@/components/crud/use-unsaved-changes';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  // O `<label>` envolve o controlo em vez de ser irmao: um label que envolve o
  // `<select>` associa-lhe o nome sem `htmlFor` nem ids. Antes eram irmaos, e o
  // campo ficava sem nome acessivel — o `getByLabel` nao o encontrava e um leitor
  // de ecra anunciava «caixa de selecao, sem rotulo».
  // A tipografia vai no texto, nao no wrapper. Um `<label>` que envolve o controlo
  // passa a ser pai do `<select>`, e o preflight do Tailwind v4 poe `font: inherit`
  // nos controlos: o `font-medium` do `Label` chegava ao texto do campo e deixava-o
  // a negrito medio sem ninguem o ter decidido. Num `label` simples so o `<span>` e
  // negrito, e o controlo volta ao peso normal.
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium leading-none">{label}</span>
      {children}
    </label>
  );
}

/** A prova que acabou de ser guardada: serve para dizer onde está e para a poder dar a uma turma. */
interface SavedExam { id: number; title: string; published: boolean; snapshot: string; savedAt: string }
/** `savedAt` é um instante do browser; a hora mostra-se no fuso de Luanda. */
const SAVED_AT = new Intl.DateTimeFormat('pt-PT', { timeZone: 'Africa/Luanda', hour: '2-digit', minute: '2-digit' });
interface PendingFigurePublication extends SavedExam { figures: ReturnType<typeof figuresOf>; publish: boolean }

/** Anexa apenas os recortes ainda ausentes; a ordem e a legenda identificam cada recorte
 *  porque a prova acabou de ser criada e, portanto, não tem imagens pré-existentes. */
async function attachMissingFigures(statementId: number, figures: ReturnType<typeof figuresOf>) {
  if (figures.length === 0) return { failed: 0 };
  const statement = await getStatementFull(statementId);
  if (!statement.ok) return { failed: figures.length };
  const questions = Array.isArray(statement.data.questions) ? statement.data.questions as Record<string, unknown>[] : [];
  const questionIds = new Map(questions
    .filter((question) => question.parentId == null && typeof question.number === 'number' && typeof question.id === 'number')
    .map((question) => [Number(question.number), Number(question.id)]));
  const nextOrder = new Map<number, number>();
  let failed = 0;

  for (const figure of figures) {
    const questionId = questionIds.get(figure.number);
    if (!questionId) { failed += 1; continue; }
    const orderIndex = nextOrder.get(questionId) ?? 0;
    nextOrder.set(questionId, orderIndex + 1);
    const existing = await listQuestionImages(questionId);
    if (!existing.ok) { failed += 1; continue; }
    if (existing.data.some((image) => Number(image.orderIndex) === orderIndex && String(image.caption ?? '') === (figure.caption.trim() || ''))) continue;

    try {
      const blob = await (await fetch(figure.dataUrl)).blob();
      const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1] || 'png';
      const file = new File([blob], `questao-${figure.number}-${orderIndex + 1}.${extension}`, { type: blob.type });
      const form = new FormData();
      form.set('file', file);
      form.set('questionId', String(questionId));
      form.set('orderIndex', String(orderIndex));
      form.set('caption', figure.caption);
      const uploaded = await uploadQuestionImage(form);
      if (!uploaded.ok) failed += 1;
    } catch {
      failed += 1;
    }
  }
  return { failed };
}

export function ExamBuilder({ openImport = false, donationId = null }: { openImport?: boolean; donationId?: number | null }) {
  /** Abaixo de `lg` a folha vem depois de sete cartões: o alternador mostra uma coisa de cada vez. */
  const [view, setView] = useState<'editar' | 'previsualizar'>('editar');
  const [schools, setSchools] = useState<School[]>([]);
  const [subjectIds, setSubjectIds] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<ExamDraft>(EMPTY_DRAFT);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [choices, setChoices] = useState<ReviewChoices | null>(null);
  const [classId, setClassId] = useState('');
  const [importOpen, setImportOpen] = useState(openImport);
  const [notes, setNotes] = useState<ImportedNote[]>([]);
  const [footerPreview, setFooterPreview] = useState<{ dataUrl: string; pageIndex: number | null; text: string[] } | null>(null);
  /** As páginas originais lidas pelo OCR, lado a lado com o rascunho. A posse
   *  dos URLs é daqui: revogam-se ao trocar, ao limpar e ao sair. */
  const [originais, setOriginais] = useState<OriginalPage[] | null>(null);
  const originaisRef = useRef<OriginalPage[] | null>(null);
  const [originalAberto, setOriginalAberto] = useState<OriginalPage | null>(null);
  /** Nº de páginas de cada PDF dos originais (chave = object URL); imagens contam 1. */
  const [pdfs, setPdfs] = useState(new Map<string, number>());
  /** Os PDF reconstituídos dos URLs, para reler uma página sem novo upload do ficheiro. */
  const pdfFiles = useRef(new Map<string, File>());
  /** A página a reler, enquanto corre (chave `${url}#${page}`): uma de cada vez. */
  const [relendo, setRelendo] = useState<string | null>(null);

  function trocarOriginais(next: OriginalPage[] | null) {
    for (const o of originaisRef.current ?? []) URL.revokeObjectURL(o.url);
    originaisRef.current = next;
    pdfFiles.current.clear();
    setPdfs(new Map());
    setOriginais(next);
  }

  useEffect(() => () => {
    for (const o of originaisRef.current ?? []) URL.revokeObjectURL(o.url);
    originaisRef.current = null;
    pdfFiles.current.clear();
  }, []);

  // Conta as páginas de cada PDF dos originais uma vez: sem isto, «Repetir a
  // leitura» não sabe que páginas existem. Imagens não precisam — contam 1.
  useEffect(() => {
    let alive = true;
    for (const o of originais ?? []) {
      if (o.kind !== 'pdf' || pdfs.has(o.url)) continue;
      void (async () => {
        try {
          const blob = await (await fetch(o.url)).blob();
          const f = new File([blob], o.name, { type: 'application/pdf' });
          pdfFiles.current.set(o.url, f);
          const n = await pdfPageCount(f);
          if (alive && n != null) setPdfs((cur) => (cur.get(o.url) === n ? cur : new Map(cur).set(o.url, n)));
        } catch {
          // Sem PDF legível fica sem painel de páginas; o cartão continua a abrir no dialog.
        }
      })();
    }
    return () => { alive = false; };
  }, [originais, pdfs]);
  const [saved, setSaved] = useState<SavedExam | null>(null);
  const [pendingPublication, setPendingPublication] = useState<PendingFigurePublication | null>(null);
  const [donation, setDonation] = useState<DonationDetail | null>(null);
  const [reading, setReading] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const draftDecisionPending = useRef(false);
  const builderDirty = ready && draftHasContent(draft) && (saved === null || saved.snapshot !== JSON.stringify(draft));
  const { dialog: unsavedDialog } = useUnsavedChanges(builderDirty, 'O rascunho local volta na próxima visita, mas as alterações ainda não foram publicadas.');

  // As escolas vêm do backend: só aquelas a que o professor está afiliado (o administrador vê todas).
  useEffect(() => {
    // O construtor abre sempre limpo (#362). O rascunho em localStorage já não entra
    // sozinho: um professor que voltasse para montar outra prova encontrava o
    // formulário preenchido com a prova anterior, de outra escola ou de há semanas,
    // sem o ter pedido. Se houver trabalho por guardar, pergunta-se — e só nesse caso.
    const anterior = loadDraft();
    const continueDraft = () => {
      setDraft(anterior);
      if (anterior.savedStatementId) {
        setSaved({
          id: anterior.savedStatementId,
          title: anterior.title.trim() || 'Prova guardada',
          published: anterior.savedPublished === true,
          snapshot: JSON.stringify(anterior),
          savedAt: anterior.savedAt ?? new Date().toISOString(),
        });
      }
    };
    const hasDraft = draftHasContent(anterior);
    let task: number | undefined;
    if (hasDraft) {
      draftDecisionPending.current = true;
      task = window.setTimeout(() => setConfirm({
          title: 'Continuar o rascunho?',
          description: 'Há um rascunho guardado localmente. Pode retomá-lo ou começar do zero. Começar do zero descarta definitivamente este rascunho local; a prova já guardada continua disponível.',
          action: 'Continuar rascunho',
          cancelLabel: 'Começar do zero',
          requireChoice: true,
          onCancel: () => { clearDraft(); draftDecisionPending.current = false; },
          run: () => { continueDraft(); draftDecisionPending.current = false; },
        }), 0);
    } else clearDraft();
    myInstitutions().then((res) => {
      if (!res.ok) reportActionError(res.error);
      else setSchools(res.data.map((i) => ({ id: String(i.id), name: i.name, logo: i.logo ?? '', subjects: [] })));
      setReady(true);
    });
    return () => { if (task !== undefined) window.clearTimeout(task); };
  }, []);
  // Um rascunho vazio não se guarda: assim «começar do zero» deixa a chave mesmo
  // limpa, em vez de a reescrever vazia no instante a seguir ao aviso.
  useEffect(() => {
    if (!ready || draftDecisionPending.current) return;
    if (draftHasContent(draft)) saveDraft(draft);
    else clearDraft();
  }, [confirm, draft, ready]);
  // Uma doação aberta no construtor: os dados dela, para o administrador ver de onde vem a prova.
  useEffect(() => {
    if (donationId === null) return;
    getDonation(donationId).then((res) => (res.ok ? setDonation(res.data) : reportActionError(res.error)));
  }, [donationId]);
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
      if (!r.ok) return void reportActionError(r.error);
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
    if (!school || !subject || pendingPublication) return;
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
    const figures = figuresOf(draft.items);
    if (saved) {
      const chosen = chosenClassId ? classOptions.find((option) => String(option.value) === chosenClassId) : undefined;
      const statement: StatementInput = {
        institutionId: Number(school.id),
        subjectId: subjectIds[subject],
        title: payload.title,
        examType: draft.kind,
        durationMinutes: draft.duration === '' ? null : Number(draft.duration),
        variant: draft.variant.trim() || null,
        instructions: draft.rules.filter(Boolean).join('\n') || null,
        totalMaxScore: totalScore(draft.items),
        schoolYearId: chosen?.schoolYearId ?? null,
        termId: null,
        classId: chosenClassId ? Number(chosenClassId) : null,
        courseId: chosen?.courseId ?? null,
      };
      const updated = await updateManualStatement(saved.id, statement, toUpdateRequest(draft.items), saved.published);
      setSaving(false);
      if (!updated.ok) return toast.error(updated.error);
      const identifiedDraft = applyUpdateIdentities(draft, updated.data.identities);
      setDraft(identifiedDraft);
      if (updated.data.failed.length > 0) {
        toast.error(`A prova ficou parcialmente guardada. ${updated.data.failed[0]} As alterações continuam no rascunho; tente guardar novamente.`);
        return;
      }

      const savedAt = new Date().toISOString();
      const shouldPublish = publish || saved.published;
      const savedDraft = {
        ...identifiedDraft,
        savedStatementId: saved.id,
        savedAt,
        savedPublished: false,
      };
      const updatedExam: SavedExam = {
        ...saved,
        title: statement.title,
        published: false,
        snapshot: JSON.stringify(savedDraft),
        savedAt,
      };
      setDraft(savedDraft);
      setSaved(updatedExam);
      if (figures.length > 0) {
        const pending = { ...updatedExam, figures, publish: shouldPublish };
        setPendingPublication(pending);
        await resumeFigurePublication(pending);
        return;
      }
      if (shouldPublish) {
        const approved = await approveStatement(saved.id);
        if (!approved.ok) return toast.error(`Prova guardada, mas não publicada: ${approved.error}`);
        const visible = await setStatementVisible(saved.id, true);
        if (!visible.ok) return toast.error(`Prova aprovada, mas continua oculta: ${visible.error}`);
      }
      const completedDraft = { ...savedDraft, savedPublished: shouldPublish };
      setDraft(completedDraft);
      setSaved({ ...updatedExam, published: shouldPublish, snapshot: JSON.stringify(completedDraft) });
      toast.success(shouldPublish ? 'Prova atualizada e publicada.' : 'Prova guardada. Fica oculta até a publicar.');
      return;
    }

    // Com imagens OCR, primeiro cria-se sempre um registo oculto. O caminho de publicação
    // só é autorizado depois de confirmar todos os recortes no servidor.
    const res = publish && figures.length === 0
      ? await publishManualStatement(payload)
      : await createManualStatement({ ...payload, visible: false });
    setSaving(false);
    if (!res.ok) return reportActionError(res.error);
    const id = Number(res.data.id);
    const savedAt = new Date().toISOString();
    const full = await getStatementForReview(id);
    const savedDraft = {
      ...(full.ok ? applyServerIds(draft, full.data) : draft),
      savedStatementId: id,
      savedAt,
      savedPublished: publish && figures.length === 0,
    };
    if (!full.ok) toast.error(`A prova foi guardada, mas não foi possível carregar os ids para futuras alterações: ${full.error}`);
    setDraft(savedDraft);
    const savedExam: SavedExam = {
      id,
      title: String(res.data.title ?? payload.title),
      published: publish && figures.length === 0,
      snapshot: JSON.stringify(savedDraft),
      savedAt,
    };
    setSaved(savedExam);
    const pending = figures.length > 0 ? { ...savedExam, published: false, figures, publish } : null;
    if (pending) setPendingPublication(pending);
    // A prova nasceu de uma doação: liga-as, e a doação passa a «convertida». Falhar aqui não
    // desfaz a prova (já existe); avisa-se para a ligação se refazer na doação.
    if (donationId !== null) {
      const linked = await linkDonationStatement(donationId, Number(res.data.id));
      if (linked.ok) setDonation(linked.data);
      else toast.error(`A prova ficou criada, mas não ficou ligada à doação: ${linked.error}`);
    }
    if (pending) {
      await resumeFigurePublication(pending);
      return;
    }
    toast.success(publish ? 'Prova publicada. Os alunos já a podem simular.' : 'Prova guardada. Fica oculta até a publicar.');
  }

  async function resumeFigurePublication(pending: PendingFigurePublication) {
    setSaving(true);
    const result = await attachMissingFigures(pending.id, pending.figures);
    if (result.failed > 0) {
      setSaving(false);
      setPendingPublication(pending);
      setSaved({ ...pending, published: false });
      toast.error(`${result.failed} recorte(s) não foram anexados. A prova continua oculta; tente novamente para retomar.`);
      return;
    }
    if (pending.publish) {
      const approved = await approveStatement(pending.id);
      if (!approved.ok) {
        setSaving(false);
        setPendingPublication(pending);
        toast.error(`Os recortes foram anexados, mas a aprovação falhou: ${approved.error}`);
        return;
      }
      const visible = await setStatementVisible(pending.id, true);
      if (!visible.ok) {
        setSaving(false);
        setPendingPublication(pending);
        toast.error(`A prova foi aprovada, mas continua oculta: ${visible.error}`);
        return;
      }
      setSaved({ ...pending, published: true });
      toast.success('Prova publicada. Os alunos já a podem simular.');
    } else {
      setSaved({ ...pending, published: false });
      toast.success('Prova guardada com todos os recortes. Continua oculta até a publicar.');
    }
    setPendingPublication(null);
    setSaving(false);
  }

  /**
   * O que o OCR leu vira rascunho. Não se guarda nada: o professor corrige aqui e só depois grava.
   * Substituir um rascunho com conteúdo pede confirmação, porque o OCR trocava tudo de uma vez.
   */
  function commitImport(extraction: ExamExtraction, names: string, originals?: OriginalPage[]): boolean {
    const imported = draftFromExtraction(extraction, { subjects: school?.subjects ?? [] });
    if (imported.items.length === 0) {
      setNotes(imported.notes);
      setFooterPreview(imported.footerPreview ?? null);
      trocarOriginais(originals ?? null);
      toast.error('Não foi possível ler questões nesta imagem.');
      return false;
    }
    setDraft((d) => ({ ...d, ...imported.patch, items: imported.items }));
    setNotes(imported.notes);
    setFooterPreview(imported.footerPreview ?? null);
    trocarOriginais(originals ?? null);
    setSaved(null);
    setImportOpen(false);
    toast.success(`Prova lida (${names}): ${imported.items.length} questões. Reveja o que o OCR percebeu.`);
    return true;
  }

  function applyImport(extraction: ExamExtraction, names: string, originals?: OriginalPage[]): boolean {
    // O OCR substitui o cabeçalho inteiro, por isso também se confirma quando só
    // escola, disciplina ou duração foram preenchidas.
    if (draftHasContent(draft)) {
      setConfirm({
        title: 'Substituir o rascunho?',
        description: 'Importar substitui as questões e o cabeçalho que já escreveu.',
        action: 'Importar e substituir',
        destructive: true,
        run: () => { commitImport(extraction, names, originals); },
      });
      return false;
    }
    return commitImport(extraction, names, originals);
  }

  /** Leva à questão indicada (as notas dizem «Ir para a questão N», as pendências
   *  «Rever a questão N»): faz scroll e entrega o foco, para rato, teclado e leitor
   *  de ecrã. Com `label` (uma alínea, ex.: `a`), o foco vai ao controlo da alínea,
   *  não ao fieldset inteiro. */
  function irParaQuestao(n: number, label?: string) {
    const alvo = document.getElementById(`questao-${n}`);
    if (!alvo) {
      toast.error(`A questão ${n} já não está nesta posição. Procure-a pelo número no editor.`);
      return;
    }
    alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      const leaf = label ? alvo.querySelector<HTMLElement>(`[data-leaf="${n}${label}"]`) : null;
      const controlo = leaf?.querySelector<HTMLElement>('textarea, input, select, button, [role="textbox"]');
      if (controlo) { controlo.focus({ preventScroll: true }); return; }
      (alvo as HTMLElement).focus({ preventScroll: true });
    }, 350);
  }

  /** «Repetir a leitura» de uma página de PDF do original: renderiza a página, lê-a
   *  de novo e troca, no rascunho, as questões que vieram dela. O resto do rascunho
   *  fica como estava — é a correção local, sem ler a prova outra vez. */
  async function repetirLeitura(o: OriginalPage, page: number, pageIndex: number) {
    if (relendo) return;
    setRelendo(`${o.url}#${page}`);
    try {
      const f = pdfFiles.current.get(o.url) ?? null;
      if (!f) { toast.error(`Não foi possível abrir «${o.name}» para reler a página ${page}.`); return; }
      const image = await renderPdfPageToImage(f, page);
      if (!image) { toast.error(`Não foi possível renderizar a página ${page} de «${o.name}».`); return; }
      const form = new FormData();
      form.append('files', image, image.name);
      const extraction = await streamExamOcr(form, { onUploadProgress: () => undefined, onEvent: () => undefined });
      const imported = draftFromExtraction(extraction, { subjects: school?.subjects ?? [] }, { sourcePageIndex: pageIndex });
      if (imported.items.length === 0) {
        toast.error(`A página ${page} de «${o.name}» não rendeu questões. Nada mudou.`);
        return;
      }
      const merged = mergePageRetry(draft.items, imported.items, pageIndex);
      if (merged.ambiguous) {
        const message = `As questões da página ${page} não puderam ser localizadas no rascunho. Acrescentar as ${imported.items.length} que o OCR leu ao fim da prova?`;
        if (!window.confirm(message)) return;
        setDraft((d) => ({ ...d, items: [...d.items, ...imported.items] }));
      } else {
        setDraft((d) => ({ ...d, items: merged.items }));
      }
      // As notas desta leitura entram sem repetir o que o rascunho já mostrava.
      setNotes((cur) => [...cur, ...imported.notes.filter((n) => !cur.some((c) => c.text === n.text))]);
      setSaved(null);
      toast.success(`Página ${page} relida: ${merged.ambiguous ? imported.items.length : merged.added} questão(ões) no lugar de ${merged.replaced}.`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'A releitura da página falhou.');
    } finally {
      setRelendo(null);
    }
  }

  /** Abre o original de onde uma questão saiu (a página ao índice global da leitura). */
  function abrirOriginal(pageIndex: number) {
    const list = originais ?? [];
    const alvo = pageAtSources((i) => (list[i]?.kind === 'image' ? 1 : pdfs.get(list[i].url) ?? 1), list.length, pageIndex);
    if (!alvo) {
      toast.error('A página deste original já não está entre as páginas lidas.');
      return;
    }
    setOriginalAberto(list[alvo.sourceIndex]);
  }

  /** O OCR sobre os ficheiros da doação: o mesmo caminho do importador, sem ficheiros novos. */
  async function readDonation() {
    if (donationId === null) return;
    setReading(true);
    const res = await extractDonation(donationId);
    setReading(false);
    if (!res.ok) return void reportActionError(res.error);
    applyImport(res.data, donation?.reference ?? `doação ${donationId}`);
  }

  const setItem = (i: number, patch: Partial<ExamDraft['items'][number]>) => set('items', draft.items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setRule = (i: number, v: string) => set('rules', draft.rules.map((x, j) => (j === i ? v : x)));
  /** Reordena no rascunho; a ordem vai no pedido de criação, que é quem a guarda. */
  const moveItem = (i: number, direction: -1 | 1) => set('items', move(draft.items, i, direction));
  const total = totalScore(draft.items);
  /** Problemas com destino: cada linha tem as questões/alíneas que a explicam. */
  const detalhes = problemDetails(draft.items);
  const problemas = detalhes.map((d) => d.message);
  /** Páginas por original, na ordem global da leitura (índice 0-based): imagens
   *  contam 1; um PDF conta o que já foi apurado (até lá, 1). */
  const contagens = originais?.map((o) => (o.kind === 'image' ? 1 : pdfs.get(o.url) ?? 1)) ?? [];
  const paginasOriginais = flattenSourcePages(originais ?? [], contagens);
  const ready2print = !!school && !!subject && draft.items.some((i) => i.text.trim());
  const canSave = ready2print && classChosen;
  /** O motivo dos botões desativados, em texto: um `title` não chega a quem usa toque ou teclado. */
  const parts = readinessParts(
    missingToSave({ hasSchool: !!school, hasSubject: !!subject, hasClass: classChosen, hasQuestion: draft.items.some((i) => i.text.trim()) }),
    problemas.length,
  );
  const changedSinceSave = saved !== null && saved.snapshot !== JSON.stringify(draft);
  const unchangedSinceSave = saved !== null && !changedSinceSave;
  const toSave = canSave && !saving && !unchangedSinceSave && pendingPublication === null;
  /** Quando não é por falta de dados: a gravar, já guardada ou a publicação por retomar. */
  const blocker = saveBlocker({ saving, unchangedSinceSave, pendingPublication: pendingPublication !== null });
  const hasSummary = parts.toSave !== null || parts.toPublish !== null;
  // Cada botão aponta só para o que o explica: «Guardar» ativo não deve ler os problemas que só travam «Publicar».
  const describeSave = [parts.toSave && 'construtor-faltas', blocker && 'construtor-estado'].filter(Boolean).join(' ') || undefined;
  const describePublish = [parts.toSave && 'construtor-faltas', parts.toPublish && 'construtor-problemas', blocker && 'construtor-estado'].filter(Boolean).join(' ') || undefined;

  /** Troca a vista e volta ao alternador: sem isto a página ficava a meio da vista anterior. */
  function showView(next: 'editar' | 'previsualizar') {
    if (next === view) return;
    setView(next);
    requestAnimationFrame(() => document.getElementById('construtor-vista')?.scrollIntoView({ block: 'start' }));
  }

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8 lg:p-10">
      <style>{`@media print{body *{visibility:hidden}#exam-sheet,#exam-sheet *{visibility:visible}#exam-sheet{position:absolute;left:0;top:0;width:100%;box-shadow:none}.exam-preview{display:block!important}@page{size:A4;margin:10mm}}`}</style>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl leading-tight tracking-tight">Montar prova</h1>
          <p className="mt-1 text-muted-foreground">A prova segue o modelo oficial. Só o logótipo, o nome da escola e a disciplina mudam.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setImportOpen((v) => !v); setView('editar'); }} aria-expanded={importOpen} disabled={pendingPublication !== null}>
            <ScanText aria-hidden /> Importar de imagem
          </Button>
          <Button variant="outline" onClick={() => save(false)} disabled={!toSave} aria-describedby={describeSave}>
            <Save aria-hidden /> Guardar
          </Button>
          <Button onClick={() => save(true)} disabled={!toSave || problemas.length > 0} aria-describedby={describePublish}>
            {saving ? <Spinner className="size-4" /> : <Check aria-hidden />}
            Publicar
          </Button>
          <Button variant="outline" onClick={() => window.print()} disabled={!ready2print}>
            <Printer aria-hidden /> Imprimir / guardar PDF
          </Button>
          {saved ? <span className="self-center text-xs text-muted-foreground" role="status">{changedSinceSave ? 'Alterações por guardar' : `Guardado às ${SAVED_AT.format(new Date(saved.savedAt))}`}</span> : null}
        </div>
      </div>

      {hasSummary && (
        <div id="construtor-pendencias" className="mb-6 grid gap-0.5 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning print:hidden">
          {parts.toSave && <p id="construtor-faltas">{parts.toSave}</p>}
          {parts.toPublish && <p id="construtor-problemas">{parts.toPublish}</p>}
        </div>
      )}
      {blocker && <p id="construtor-estado" className="mb-6 text-sm text-muted-foreground print:hidden">{blocker}</p>}

      {saved && (
        <Card className="mb-6 border-primary/40 bg-accent/40 print:hidden" role="status" aria-live="polite">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Check className="size-4 text-primary" aria-hidden />{saved.published ? 'Prova publicada' : 'Prova guardada'}</CardTitle>
            <CardDescription>
              «{saved.title}» {pendingPublication ? 'continua oculta enquanto os recortes OCR não forem anexados e confirmados.' : saved.published ? 'já está disponível para os alunos simularem sozinhos.' : 'ficou oculta: publique-a para a poder dar a uma turma.'} A prova é dada a partir de um enunciado, numa sala: os alunos entram na sala e fazem a simulação.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {pendingPublication ? <Button onClick={() => resumeFigurePublication(pendingPublication)} disabled={saving}>{saving ? <Spinner className="size-4" /> : <Check aria-hidden />}{saving ? 'A retomar…' : 'Retomar anexação e publicação'}</Button> : null}
            {saved.published ? (
              <Button asChild><Link href={`/exam-rooms/new?statementId=${saved.id}`}><DoorOpen aria-hidden />Criar sala com esta prova</Link></Button>
            ) : null}
            {!pendingPublication ? <Button asChild variant="outline"><Link href={`/statements/${saved.id}`}><FileText aria-hidden />Ver o enunciado</Link></Button> : null}
            <Button variant="ghost" disabled={pendingPublication !== null} onClick={() => setConfirm({
              title: 'Começar uma prova nova?',
              description: 'O rascunho atual será limpo. A prova já guardada continua disponível.',
              action: 'Começar nova prova',
              destructive: true,
              run: () => { // `EMPTY_DRAFT` mesmo: `schoolId: ''` já volta a escolher a primeira escola no
              // select, e preservar o id fazia o rascunho limpo contar como conteúdo e
              // voltar a ser guardado — um aviso a mais no arranque seguinte.
              setDraft(EMPTY_DRAFT); setNotes([]); setFooterPreview(null); trocarOriginais(null); setSaved(null);
            }} )}>
              <Plus aria-hidden />Nova prova
            </Button>
          </CardContent>
        </Card>
      )}

      <div id="construtor-vista" role="group" aria-label="Vista do construtor" className="mb-4 grid scroll-mt-20 grid-cols-2 gap-1 rounded-lg border bg-muted p-1 lg:hidden print:hidden">
        {([['editar', 'Editar'], ['previsualizar', 'Pré-visualizar']] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            onClick={() => showView(value)}
            className={cn(
              'min-h-11 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              view === value ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className={cn('grid grid-cols-[minmax(0,1fr)] gap-4 print:hidden', view !== 'editar' && 'max-lg:hidden')}>
          {donationId !== null && (
            <Card className="print:hidden" role="region" aria-label="Doação de origem">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Gift className="size-4 text-primary" aria-hidden />Doação {donation?.reference ?? `#${donationId}`}</CardTitle>
                <CardDescription>
                  {donation
                    ? `${donation.subjectName} · ${donation.examType} · ${donation.institutionName}. ${donation.files.length} ficheiro(s).`
                    : 'A carregar a doação…'}
                  {' '}O OCR lê os ficheiros e preenche o construtor; ao guardar, a doação fica ligada à prova.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button onClick={readDonation} disabled={!donation || reading || !ready}>
                  {reading ? <Spinner className="size-4" /> : <ScanText aria-hidden />}
                  {reading ? 'A ler a prova…' : 'Ler os ficheiros com o OCR'}
                </Button>
                <Button asChild variant="outline"><Link href={`/donations/${donationId}`}>Ver a doação</Link></Button>
              </CardContent>
            </Card>
          )}

          {importOpen && <ExamImporter onExtracted={applyImport} onClose={() => setImportOpen(false)} />}
          <Confirm state={confirm} onClose={() => setConfirm(null)} />

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
                <ul className="grid gap-2.5 text-sm">
                  {notes.map((n, i) => (
                    <li key={`${i}-${n.text.slice(0, 24)}`} className="grid gap-1">
                      <span>{n.text}</span>
                      {typeof n.question === 'number' ? (
                        <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => irParaQuestao(n.question!)}>
                          Ir para a questão {n.question}
                        </Button>
                      ) : n.anchor === 'rodape' ? (
                        <Button type="button" variant="outline" size="sm" className="justify-self-start" asChild>
                          <a href="#ocr-rodape">Ver rodapé original</a>
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {originais && originais.length > 0 && (
            <Card className="print:hidden" data-testid="ocr-originais">
              <CardHeader>
                <CardTitle>Páginas originais</CardTitle>
                <CardDescription>As páginas lidas, na ordem da leitura. Toque para ver em tamanho real.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-wrap gap-4">
                  {originais.map((o, oi) => (
                    <li key={o.url} className="grid gap-1">
                      <button
                        type="button"
                        onClick={() => setOriginalAberto(o)}
                        aria-label={`Ver ${o.name} em tamanho real`}
                        className="grid w-24 gap-1 rounded-lg border bg-card p-1.5 text-left transition-colors hover:border-primary"
                      >
                        {o.kind === 'image' ? (
                          <img src={o.url} alt="" aria-hidden className="h-20 w-full rounded object-cover" />
                        ) : (
                          /* Página 1 renderizada: o File veio do URL no efeito de contagem. */
                          pdfFiles.current.has(o.url)
                            ? <SourceThumb file={pdfFiles.current.get(o.url)!} kind="pdf" className="h-20 w-full rounded object-cover" />
                            : <span className="grid h-20 w-full place-items-center rounded bg-accent text-primary"><FileText size={20} aria-hidden /></span>
                        )}
                        <span className="truncate text-[11px] text-muted-foreground">{o.name}</span>
                      </button>
                      {/* Páginas de um PDF: cada uma pode ser relida sozinha — o rascunho
                          troca só as questões que vieram dela (`mergePageRetry`). */}
                      {o.kind === 'pdf' && pdfFiles.current.has(o.url) && (pdfs.get(o.url) ?? 0) > 1 && (
                        <div className="flex flex-wrap gap-1">
                          {paginasOriginais.filter((p) => p.sourceIndex === oi).map((p) => (
                            <button
                              key={p.pageIndex}
                              type="button"
                              className="grid w-12 gap-0.5 rounded-md border bg-card p-0.5 text-center transition-colors hover:border-primary disabled:opacity-60"
                              disabled={relendo !== null}
                              aria-label={`Repetir a leitura da página ${p.page} de ${o.name}`}
                              onClick={() => void repetirLeitura(o, p.page, p.pageIndex)}
                            >
                              <SourceThumb file={pdfFiles.current.get(o.url)!} kind="pdf" page={p.page} className="h-10 w-full rounded object-cover" />
                              <span className="grid h-3.5 place-items-center text-[10px] tabular-nums text-muted-foreground">
                                {relendo === `${o.url}#${p.page}` ? <Spinner className="size-3" /> : p.page}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Dialog open={originalAberto !== null} onOpenChange={(aberto) => { if (!aberto) setOriginalAberto(null); }}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{originalAberto?.name}</DialogTitle>
              </DialogHeader>
              {originalAberto?.kind === 'image' ? (
                <img src={originalAberto.url} alt={`Página original ${originalAberto.name}`} className="max-h-[70dvh] w-full rounded-lg border object-contain" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Pré-visualização de PDF em tamanho real não cabe aqui.{' '}
                  <a href={originalAberto?.url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">Abrir {originalAberto?.name} num separador</a>.
                </p>
              )}
            </DialogContent>
          </Dialog>

          {footerPreview && (
            <Card data-testid="ocr-footer-preview" id="ocr-rodape" className="scroll-mt-20">
              <CardHeader>
                <CardTitle>Rodapé original — fora das questões</CardTitle>
                <CardDescription>
                  Recorte da página {(footerPreview.pageIndex ?? 0) + 1}, mantido para conferência. Não será impresso como parte das perguntas.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <img src={footerPreview.dataUrl} alt="Rodapé original da prova, incluindo contacto e coordenação" className="max-h-72 w-full rounded-lg border object-contain object-left-top" />
                {footerPreview.text.length > 0 && <p className="text-sm text-muted-foreground">Texto reconhecido: {footerPreview.text.join(' · ')}</p>}
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
            <CardContent className="grid min-w-0 gap-3">
              {draft.items.map((it, i) => (
                <QuestionEditor
                  key={i}
                  item={it}
                  index={i}
                  total={draft.items.length}
                  onChange={(patch) => setItem(i, patch)}
                  onRemove={() => set('items', draft.items.filter((_, j) => j !== i))}
                  onMove={(direction) => moveItem(i, direction)}
                  onOpenOriginal={originais ? abrirOriginal : undefined}
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
                <ul role="status" className="grid gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning">
                  {detalhes.map((p) => (
                    <li key={p.message} className="grid gap-1.5">
                      <span>{p.message}</span>
                      {p.targets.length > 0 && (
                        <span className="flex flex-wrap gap-1">
                          {p.targets.map((t) => (
                            <Button
                              key={`${t.question}-${t.label ?? ''}`}
                              type="button"
                              variant="outline"
                              size="sm"
                              data-testid={`ir-para-questao-${t.question}${t.label ?? ''}`}
                              onClick={() => irParaQuestao(t.question, t.label)}
                            >
                              Rever a questão {t.question}{t.label ?? ''}
                            </Button>
                          ))}
                        </span>
                      )}
                    </li>
                  ))}
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

        <div className={cn('exam-preview min-w-0 overflow-x-auto lg:sticky lg:top-24', view !== 'previsualizar' && 'max-lg:hidden')}>
          <ExamSheet school={school} draft={draft} />
        </div>
      </div>
      {unsavedDialog}
    </div>
  );
}
