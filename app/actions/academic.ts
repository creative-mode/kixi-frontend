'use server';

import { revalidatePath } from 'next/cache';
import { call, fail, guard, message, ok, type Result } from '@/lib/crud/http';
import { forgetReference, readReference } from '@/lib/crud/reference';
import type { CurriculumEntry, InstitutionStructure, SubjectOfferings, TeacherOverview } from '@/lib/academic/types';

/** Estrutura académica (issue #178): leitura agregada e as escritas que o assistente faz por cima do CRUD genérico. */
const id = (v: string | number) => {
  const s = String(v);
  if (!/^[A-Za-z0-9_.-]+$/.test(s)) throw new Error('Identificador inválido');
  return encodeURIComponent(s);
};

async function read<T>(path: string): Promise<Result<T>> {
  return guard(async () => {
    const res = await call(path);
    if (!res.ok) return fail(await message(res));
    return ok((await res.json()) as T);
  });
}

export async function getStructure(institutionId: number, schoolYearId?: number): Promise<Result<InstitutionStructure>> {
  const q = schoolYearId ? `?schoolYearId=${id(schoolYearId)}` : '';
  return read(`/api/v1/institutions/${id(institutionId)}/structure${q}`);
}

/** `teacherId` omitido = o professor com sessão. */
export async function getTeacherOverview(teacherId?: number): Promise<Result<TeacherOverview>> {
  return read(teacherId ? `/api/v1/teachers/${id(teacherId)}/overview` : '/api/v1/teachers/me/overview');
}

export async function getSubjectOfferings(code: string): Promise<Result<SubjectOfferings>> {
  return read(`/api/v1/subjects/${id(code)}/offerings`);
}

export async function listCurriculum(courseId: number): Promise<Result<CurriculumEntry[]>> {
  return guard(async () => {
    const res = await call(`/api/v1/courses/${id(courseId)}/subjects`);
    if (!res.ok) return fail(await message(res));
    const rows = (await res.json()) as (Omit<CurriculumEntry, 'linkId'> & { id: number })[];
    return ok(rows.map(({ id: linkId, ...r }) => ({ ...r, linkId })));
  });
}

export async function addToCurriculum(courseId: number, subjectId: number, grade: number | null): Promise<Result> {
  return guard(async () => {
    const res = await call(`/api/v1/courses/${id(courseId)}/subjects`, { method: 'POST', body: JSON.stringify({ subjectId, grade }) });
    if (!res.ok) return fail(await message(res));
    forgetReference('curriculum');
    revalidatePath('/institutions');
    return ok(undefined);
  });
}

export async function removeFromCurriculum(courseId: number, linkId: number): Promise<Result> {
  return guard(async () => {
    const res = await call(`/api/v1/courses/${id(courseId)}/subjects/${id(linkId)}`, { method: 'DELETE' });
    if (!res.ok) return fail(await message(res));
    forgetReference('curriculum');
    revalidatePath('/institutions');
    return ok(undefined);
  });
}

/** Atribui um professor a (turma, disciplina). O ano vem da turma; o backend recusa quem não é da escola ou disciplina fora do currículo (422). */
export async function assignTeacher(input: { teacherId: number; classId: number; subjectId: number; schoolYearId: number }): Promise<Result> {
  return guard(async () => {
    const res = await call('/api/v1/teaching-assignments', {
      method: 'POST',
      body: JSON.stringify({ teacherId: input.teacherId, classId: input.classId, subjectId: input.subjectId, schoolYearId: input.schoolYearId, tutorStyle: null }),
    });
    if (!res.ok) return fail(await message(res));
    forgetReference('teaching-assignments');
    return ok(undefined);
  });
}

export async function unassignTeacher(assignmentId: number): Promise<Result> {
  return guard(async () => {
    const res = await call(`/api/v1/teaching-assignments/${id(assignmentId)}`, { method: 'DELETE' });
    if (!res.ok) return fail(await message(res));
    forgetReference('teaching-assignments');
    return ok(undefined);
  });
}

export interface ClassOption { id: number; code: string; grade: number; courseName: string; schoolYear: string }

/** Turmas de uma escola (a turma herda a escola do curso), para o seletor em cascata. */
export async function classesOfInstitution(institutionId: number): Promise<Result<ClassOption[]>> {
  return guard(async () => {
    const path = `/api/v1/classes?institutionId=${id(institutionId)}`;
    const res = await readReference<{ id: number; code: string; grade: number; course?: { name: string }; schoolYear?: { startYear: number; endYear: number } }[]>(path, ['classes'], () => call(path));
    if (!res.ok) return fail(res.error);
    return ok(res.data.map((c) => ({
      id: c.id, code: c.code, grade: c.grade, courseName: c.course?.name ?? '',
      schoolYear: c.schoolYear ? `${c.schoolYear.startYear}–${c.schoolYear.endYear}` : '',
    })));
  });
}

export interface ClassSubjectOption { subjectId: number; code: string; name: string; teachers: { id: number; firstName: string; lastName: string; assignmentId: number }[] }

/** Disciplinas que a turma dá (currículo do curso para a classe), com os professores já atribuídos. */
export async function classSubjects(classId: number): Promise<Result<ClassSubjectOption[]>> {
  return guard(async () => {
    const path = `/api/v1/classes/${id(classId)}/subjects`;
    const res = await readReference<ClassSubjectOption[]>(path, ['curriculum'], () => call(path));
    return res.ok ? ok(res.data) : fail(res.error);
  });
}
