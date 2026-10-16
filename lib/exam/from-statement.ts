/**
 * Um enunciado guardado (`GET /statements/{id}/full`) posto no rascunho do construtor, para a folha da prova o
 * mostrar com o molde de quando foi montado: é o que o professor vê ao rever um enunciado, importado ou escrito
 * à mão, sem ter de o abrir no construtor.
 *
 * Pura e sem React. As alíneas vêm como questões com `parentId` e `label`; o grupo é a questão-pai, que não
 * tem resposta própria.
 */
import type { DraftImage, DraftItem, DraftOption, DraftQuestion, LeafKind } from './draft.ts';
import type { ExamDraft, School } from './schools.ts';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface StatementContext {
  institution?: string | null;
  subject?: string | null;
  /** `12` → «12ª Classe». */
  grade?: number | string | null;
  schoolYear?: string | null;
  /** As figuras de cada questão, por id. */
  images?: Record<number, { imageUrl: string; caption?: string | null }[]>;
}

const optionsOf = (q: Row): DraftOption[] =>
  ((q.options ?? []) as Row[]).map((o, i) => ({
    label: String(o.optionLabel ?? String.fromCharCode(65 + i)),
    text: String(o.optionText ?? ''),
    correct: !!o.isCorrect,
  }));

function leafKind(q: Row, options: DraftOption[]): LeafKind {
  if (options.length === 0) return 'open';
  return /true_false|verdadeiro/i.test(String(q.questionType ?? '')) ? 'true_false' : 'multiple_choice';
}

const points = (q: Row): number | '' => (typeof q.maxScore === 'number' ? q.maxScore : '');

export function draftFromStatement(statement: Row, ctx: StatementContext = {}): { draft: ExamDraft; school: School } {
  const flat = (statement.questions ?? []) as Row[];
  const children = new Map<number, Row[]>();
  for (const q of flat) {
    if (q.parentId != null) children.set(Number(q.parentId), [...(children.get(Number(q.parentId)) ?? []), q]);
  }

  const images = (id: number): DraftImage[] =>
    (ctx.images?.[id] ?? []).map((i) => ({ dataUrl: i.imageUrl, caption: i.caption ?? '' }));

  const items: DraftQuestion[] = flat
    .filter((q) => q.parentId == null)
    .map((q): DraftQuestion => {
      const found = children.get(Number(q.id));
      const picture = images(Number(q.id));
      const withImages = picture.length > 0 ? { images: picture } : {};
      if (String(q.questionType ?? '').toLowerCase() === 'group' || (found && found.length > 0)) {
        const subs: DraftItem[] = (found ?? []).map((c) => {
          const options = optionsOf(c);
          return { text: String(c.text ?? ''), points: points(c), options, kind: leafKind(c, options) };
        });
        return { text: String(q.text ?? ''), points: '', options: [], kind: 'group', items: subs, ...withImages };
      }
      const options = optionsOf(q);
      return { text: String(q.text ?? ''), points: points(q), options, kind: leafKind(q, options), ...withImages };
    });

  const grade = ctx.grade != null && ctx.grade !== '' ? (/^\d+$/.test(String(ctx.grade)) ? `${ctx.grade}ª Classe` : String(ctx.grade)) : '';
  const draft: ExamDraft = {
    schoolId: '',
    subject: ctx.subject ?? '',
    kind: String(statement.examType ?? 'Prova'),
    grade,
    phase: '',
    items,
    title: String(statement.title ?? ''),
    duration: typeof statement.durationMinutes === 'number' ? statement.durationMinutes : '',
    variant: String(statement.variant ?? ''),
    schoolYear: ctx.schoolYear ?? '',
    rules: String(statement.instructions ?? '').split(/\r?\n/).map((r) => r.trim()).filter(Boolean),
    note: '',
    place: '',
    date: '',
    teacher: '',
  };
  return { draft, school: { id: '', name: ctx.institution ?? '', logo: '', subjects: [] } };
}
