'use server';

// Salas de Prova do professor (FE-13), sobre o `ExamRoomController` do backend.
// As regras do ecrã estão em `lib/exam-rooms/model.ts`, com testes.

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth.server';
import { call, fail, guard, message, ok, type Result } from '@/lib/crud/http';
import { ENTITIES, type Row } from '@/lib/crud/entities';
import { assignmentsFrom, teacherCanWrite } from '@/lib/crud/teacher-scope';
import type { BulkGradeResult, ExamRoom, Grade, RoomAction, RoomDraft, RoomIntegrity, RoomReview } from '@/lib/exam-rooms/model';
import { draftProblem, toLocalDateTime } from '@/lib/exam-rooms/model';

const BASE = '/api/v1/exam-rooms';

const safeId = (id: number) => {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Identificador inválido.');
  return id;
};

async function json<T>(path: string): Promise<Result<T>> {
  const res = await call(path);
  if (!res.ok) return fail(await message(res));
  return ok((await res.json()) as T);
}

export type StatementChoice = {
  id: number;
  title: string;
  classId: number | null;
  durationMinutes: number | null;
  totalMaxScore: number | null;
  needsReview: boolean;
  visible: boolean;
};
export type ClassChoice = { id: number; label: string };

export type RoomContext = {
  admin: boolean;
  classes: ClassChoice[];
  statements: StatementChoice[];
};

const toStatement = (s: Row): StatementChoice => ({
  id: Number(s.id),
  title: String(s.title ?? `Enunciado ${s.id}`),
  classId: s.classId == null ? null : Number(s.classId),
  durationMinutes: s.durationMinutes == null ? null : Number(s.durationMinutes),
  totalMaxScore: s.totalMaxScore == null ? null : Number(s.totalMaxScore),
  needsReview: !!s.needsReview,
  visible: !!s.visible,
});

const classLabel = (c: Row) => {
  const course = c.course?.name ? ` · ${c.course.name}` : '';
  return `${ENTITIES.classes.titleOf(c)}${course}`;
};

/**
 * As turmas e os enunciados com que o professor pode montar uma sala. O ADMIN vê
 * tudo; o professor vê as turmas das suas atribuições e os enunciados que pode
 * escrever, que é o que o `ExamRoomService.create` vai verificar.
 */
export async function roomContext(): Promise<Result<RoomContext>> {
  return guard(async () => {
    const user = await getCurrentUser();
    if (!user) return fail('Sessão expirada. Inicie sessão novamente.');
    const admin = user.roles.includes('ADMIN');
    const [classes, statements, mine] = await Promise.all([
      json<Row[]>(ENTITIES.classes.api),
      json<Row[]>('/api/v1/statements'),
      admin ? Promise.resolve(ok<Row[]>([])) : json<Row[]>('/api/v1/teaching-assignments/me'),
    ]);
    if (!classes.ok) return classes;
    if (!statements.ok) return statements;
    if (!mine.ok) return mine;
    const assignments = assignmentsFrom(mine.data);
    const myClasses = new Set(assignments.map((a) => a.classId));
    return ok({
      admin,
      classes: classes.data
        .filter((c) => admin || myClasses.has(Number(c.id)))
        .map((c) => ({ id: Number(c.id), label: classLabel(c) })),
      statements: statements.data
        .filter((s) => admin || teacherCanWrite(assignments, s))
        .map(toStatement),
    });
  });
}

export type RoomListing = {
  rooms: ExamRoom[];
  statements: Record<number, StatementChoice>;
  /** O código da turma (12B) para as listas, e o rótulo com o curso para o detalhe. */
  classes: Record<number, { code: string; label: string }>;
};

/** As salas do professor (`/owned`), com o título do enunciado e a turma. */
export async function listRooms(): Promise<Result<RoomListing>> {
  return guard(async () => {
    const [rooms, statements, classes] = await Promise.all([
      json<ExamRoom[]>(`${BASE}/owned`),
      json<Row[]>('/api/v1/statements'),
      json<Row[]>(ENTITIES.classes.api),
    ]);
    if (!rooms.ok) return rooms;
    return ok({
      rooms: rooms.data,
      statements: Object.fromEntries((statements.ok ? statements.data : []).map((s) => [Number(s.id), toStatement(s)])),
      classes: Object.fromEntries(
        (classes.ok ? classes.data : []).map((c) => [Number(c.id), { code: ENTITIES.classes.titleOf(c), label: classLabel(c) }]),
      ),
    });
  });
}

/** Uma sala. O backend não tem `GET /exam-rooms/{id}`; a sala vem do `/owned`. */
export async function getRoom(id: number): Promise<Result<{ room: ExamRoom; statement: StatementChoice | null; classLabel: string | null }>> {
  return guard(async () => {
    const listing = await listRooms();
    if (!listing.ok) return listing;
    const room = listing.data.rooms.find((r) => r.id === safeId(id));
    if (!room) return fail('Sala não encontrada, ou não é sua.');
    return ok({
      room,
      statement: listing.data.statements[room.statementId] ?? null,
      classLabel: room.classId == null ? null : (listing.data.classes[room.classId]?.label ?? null),
    });
  });
}

/**
 * Cria a sala e convida a turma. São dois pedidos e não é atómico: se o convite
 * falhar, a sala fica criada em rascunho e a mensagem diz isso, para o professor
 * convidar de novo no ecrã da sala em vez de criar outra.
 */
export async function createRoom(draft: RoomDraft, inviteClass: boolean): Promise<Result<{ id: number; warning: string | null }>> {
  return guard(async () => {
    const problem = draftProblem(draft);
    if (problem) return fail(problem);
    const res = await call(BASE, {
      method: 'POST',
      body: JSON.stringify({
        statementId: Number(draft.statementId),
        classId: Number(draft.classId),
        startsAt: toLocalDateTime(draft.startsAt),
        endsAt: toLocalDateTime(draft.endsAt),
        durationMinutes: Number(draft.durationMinutes),
      }),
    });
    if (!res.ok) return fail(await message(res));
    const room = (await res.json()) as ExamRoom;
    let warning: string | null = null;
    if (inviteClass) {
      const invite = await inviteRoomClass(room.id, Number(draft.classId));
      if (!invite.ok) warning = `A sala foi criada, mas a turma não foi convidada: ${invite.error}`;
    }
    revalidatePath('/exam-rooms');
    return ok({ id: room.id, warning });
  });
}

/** Convida todos os alunos matriculados na turma. Repetir não duplica. */
export async function inviteRoomClass(id: number, classId: number): Promise<Result> {
  return guard(async () => {
    const res = await call(`${BASE}/${safeId(id)}/participants`, {
      method: 'POST',
      body: JSON.stringify({ classId: safeId(classId) }),
    });
    if (!res.ok) return fail(await message(res));
    return ok(undefined);
  });
}

export async function changeRoomStatus(id: number, action: RoomAction): Promise<Result<ExamRoom>> {
  return guard(async () => {
    const res = await call(`${BASE}/${safeId(id)}/${action}`, { method: 'POST' });
    if (!res.ok) return fail(await message(res));
    revalidatePath('/exam-rooms');
    return ok((await res.json()) as ExamRoom);
  });
}

export async function roomGrades(id: number): Promise<Result<Grade[]>> {
  return guard(async () => json<Grade[]>(`${BASE}/${safeId(id)}/grades`));
}

/** Os eventos do modo de avaliação (#192) da sala, por aluno. Só o dono da sala (ou
 *  o ADMIN) os lê; o backend decide, como no `/live` e no `/grades`. */
export async function roomIntegrity(id: number): Promise<Result<RoomIntegrity>> {
  return guard(async () => json<RoomIntegrity>(`${BASE}/${safeId(id)}/integrity`));
}

/** As respostas abertas da sala, questão a questão, com a chave ao lado. */
export async function roomReview(id: number): Promise<Result<RoomReview>> {
  return guard(async () => json<RoomReview>(`${BASE}/${safeId(id)}/review`));
}

/** Grava as notas dadas e, com `byKey`, a cotação inteira às respostas que coincidem com a chave. */
export async function gradeRoom(id: number, grades: { answerId: number; score: number }[], byKey: boolean): Promise<Result<BulkGradeResult>> {
  return guard(async () => {
    const res = await call(`${BASE}/${safeId(id)}/grade`, { method: 'POST', body: JSON.stringify({ grades, byKey }) });
    if (!res.ok) return fail(await message(res));
    revalidatePath('/exam-rooms');
    return ok((await res.json()) as BulkGradeResult);
  });
}
