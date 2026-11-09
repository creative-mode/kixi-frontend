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
import { fold, keywordsOf, problemsOf, type MatrixDraft, type MatrixPayload, type MatrixView } from '@/lib/exam-rooms/matrix';

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
  subjectId: number | null;
  /** O nome da disciplina, para o professor distinguir provas com o mesmo título. `null` se não se soube. */
  subjectName: string | null;
  examType: string | null;
  variant: string | null;
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
  subjectId: s.subjectId == null ? null : Number(s.subjectId),
  subjectName: null,
  examType: s.examType ? String(s.examType) : null,
  variant: s.variant ? String(s.variant) : null,
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
    const [classes, statements, mine, subjects] = await Promise.all([
      json<Row[]>(ENTITIES.classes.api),
      json<Row[]>('/api/v1/statements'),
      admin ? Promise.resolve(ok<Row[]>([])) : json<Row[]>('/api/v1/teaching-assignments/me'),
      json<Row[]>(ENTITIES.subjects.api),
    ]);
    if (!classes.ok) return classes;
    if (!statements.ok) return statements;
    if (!mine.ok) return mine;
    const assignments = assignmentsFrom(mine.data);
    const myClasses = new Set(assignments.map((a) => a.classId));
    // O nome da disciplina é só para reconhecer a prova: sem ele a lista continua a servir.
    const subjectNames = new Map((subjects.ok ? subjects.data : []).map((x) => [Number(x.id), String(x.name ?? '')]));
    return ok({
      admin,
      classes: classes.data
        .filter((c) => admin || myClasses.has(Number(c.id)))
        .map((c) => ({ id: Number(c.id), label: classLabel(c) })),
      statements: statements.data
        .filter((s) => admin || teacherCanWrite(assignments, s))
        .map((s) => ({ ...toStatement(s), subjectName: subjectNames.get(Number(s.subjectId)) || null })),
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
    if (!res.ok) return fail(await message(res), res.status === 401 ? 'SESSION_EXPIRED' : undefined);
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
    if (!res.ok) return fail(await message(res), res.status === 401 ? 'SESSION_EXPIRED' : undefined);
    revalidatePath('/exam-rooms');
    return ok((await res.json()) as BulkGradeResult);
  });
}

// ── A matriz da prova: os temas que saem, as questões e a cotação de cada um ──────────────────────────────────────

/** A matriz da sala, ou `null` quando o professor ainda não a carregou (o servidor responde 404). */
export async function getRoomMatrix(id: number): Promise<Result<MatrixView | null>> {
  return guard(async () => {
    const res = await call(`${BASE}/${safeId(id)}/matrix`);
    if (res.status === 404) return ok(null);
    if (!res.ok) return fail(await message(res));
    return ok((await res.json()) as MatrixView);
  });
}

export type SubjectTopic = { id: number; name: string; grade: number | null; keywords: string | null; questionCount: number };

/** Os temas da disciplina, com as palavras-chave e quantas questões já têm. */
export async function subjectTopics(subjectId: number): Promise<Result<SubjectTopic[]>> {
  return guard(async () => {
    const res = await json<Row[]>(`/api/v1/subjects/${safeId(subjectId)}/topics`);
    if (!res.ok) return res;
    return ok(res.data.map((t) => ({ id: Number(t.id), name: String(t.name), grade: t.grade == null ? null : Number(t.grade), keywords: t.keywords == null ? null : String(t.keywords), questionCount: Number(t.questionCount ?? 0) })));
  });
}

async function send(path: string, method: string, body: unknown): Promise<Result & { status?: number }> {
  const res = await call(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.ok ? ok(undefined) : { ...fail(await message(res)), status: res.status };
}

/**
 * Guarda a matriz (substitui a anterior). Antes, cria ou atualiza os temas que trazem palavras-chave: é por elas que
 * o Kixi encontra, nas provas anteriores, as questões de cada tema. Os temas sem palavras-chave nascem pelo nome.
 */
export async function saveRoomMatrix(id: number, draft: MatrixDraft, payload: MatrixPayload, subjectId: number | null): Promise<Result<MatrixView>> {
  return guard(async () => {
    // O servidor volta a validar; isto só evita a viagem quando o editor deixou passar um rascunho partido.
    const problems = problemsOf(draft);
    if (problems.length > 0) return fail(problems[0]!);
    const withWords = keywordsOf(draft);
    if (subjectId != null && withWords.length > 0) {
      const known = await subjectTopics(subjectId);
      if (!known.ok) return known;
      for (const { name, keywords } of withWords) {
        // Com o mesmo nome em várias classes, o tema de todas as classes (sem classe) é o que o servidor escolhe.
        const same = known.data.filter((t) => fold(t.name) === fold(name));
        const found = same.find((t) => t.grade == null) ?? same[0];
        const done = found
          ? await send(`/api/v1/topics/${found.id}`, 'PUT', { name: found.name, grade: found.grade, keywords })
          : await send(`/api/v1/subjects/${safeId(subjectId)}/topics`, 'POST', { name, keywords });
        // Um tema de outro autor não se edita (403): usam-se as palavras-chave que já tem, sem travar a matriz.
        if (!done.ok && !(found && done.status === 403)) return done;
      }
    }
    const res = await call(`${BASE}/${safeId(id)}/matrix`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) return fail(await message(res));
    return ok((await res.json()) as MatrixView);
  });
}

/** Etiqueta com tema as questões das provas da disciplina que ainda não têm nenhum (nunca mexe nas já etiquetadas). */
export async function tagSubjectQuestions(subjectId: number): Promise<Result<{ tagged: number; untagged: number; statements: number }>> {
  return guard(async () => {
    const list = await json<Row[]>('/api/v1/statements');
    if (!list.ok) return list;
    const mine = list.data.filter((s) => Number(s.subjectId) === safeId(subjectId));
    let tagged = 0;
    let untagged = 0;
    for (const statement of mine) {
      const res = await call(`/api/v1/statements/${Number(statement.id)}/topics/auto-tag`, { method: 'POST' });
      if (!res.ok) continue;
      const body = (await res.json()) as { tagged?: number; untagged?: number };
      tagged += body.tagged ?? 0;
      untagged += body.untagged ?? 0;
    }
    return ok({ tagged, untagged, statements: mine.length });
  });
}

export async function removeRoomMatrix(id: number): Promise<Result> {
  return guard(async () => {
    const res = await call(`${BASE}/${safeId(id)}/matrix`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) return fail(await message(res));
    return ok(undefined);
  });
}
