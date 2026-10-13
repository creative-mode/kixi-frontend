'use server';

// O estilo do tutor do professor (FE-18, #29), sobre o
// `PUT /teaching-assignments/{id}/tutor-style` do backend (creative-mode/kixi#206).
// As regras do ecrã (limite, pré-visualização) estão em `lib/tutor-style.ts`, com testes.

import { revalidatePath } from 'next/cache';
import { call, fail, guard, message, ok, type Result } from '@/lib/crud/http';
import { ENTITIES, type Row } from '@/lib/crud/entities';
import { styleToSave, TUTOR_STYLE_MAX } from '@/lib/tutor-style';

/** Uma atribuição do professor, com os nomes que o ecrã mostra. */
export type TutorStyleRow = {
  id: number;
  classLabel: string;
  subjectLabel: string;
  tutorStyle: string | null;
};

async function rows(path: string): Promise<Row[]> {
  const res = await call(path);
  return res.ok ? ((await res.json()) as Row[]) : [];
}

/**
 * As atribuições da conta (`/teaching-assignments/me`), com o nome da turma e da
 * disciplina. Os nomes são enfeite: se a lista de turmas ou disciplinas falhar, o
 * ecrã mostra o número em vez do nome e continua a deixar gravar.
 */
export async function myTutorStyles(): Promise<Result<TutorStyleRow[]>> {
  return guard(async () => {
    const mine = await call('/api/v1/teaching-assignments/me');
    if (!mine.ok) return fail(await message(mine));
    const [assignments, classes, subjects] = await Promise.all([
      mine.json() as Promise<Row[]>,
      rows(ENTITIES.classes.api),
      rows(ENTITIES.subjects.api),
    ]);
    const classOf = new Map(classes.map((c) => [Number(c.id), ENTITIES.classes.titleOf(c)]));
    const subjectOf = new Map(subjects.map((s) => [Number(s.id), ENTITIES.subjects.titleOf(s)]));
    return ok(
      assignments.map((a) => ({
        id: Number(a.id),
        classLabel: classOf.get(Number(a.classId)) ?? `Turma ${a.classId}`,
        subjectLabel: subjectOf.get(Number(a.subjectId)) ?? `Disciplina ${a.subjectId}`,
        tutorStyle: a.tutorStyle ?? null,
      })),
    );
  });
}

/** Grava o estilo de uma atribuição sua. Texto vazio limpa o estilo. */
export async function saveTutorStyle(id: number, raw: string): Promise<Result<string | null>> {
  return guard(async () => {
    if (!Number.isInteger(id) || id <= 0) return fail('Atribuição inválida.');
    const tutorStyle = styleToSave(raw);
    if (tutorStyle && tutorStyle.length > TUTOR_STYLE_MAX) {
      return fail(`O estilo tem no máximo ${TUTOR_STYLE_MAX} caracteres.`);
    }
    const res = await call(`/api/v1/teaching-assignments/${id}/tutor-style`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tutorStyle }),
    });
    if (!res.ok) return fail(await message(res));
    const saved = (await res.json()) as Row;
    revalidatePath('/professor/tutor');
    return ok(saved.tutorStyle ?? null);
  });
}
