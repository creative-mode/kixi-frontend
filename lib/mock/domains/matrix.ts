/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, json, problem, rooms } from '../store';
import type { MockContext } from './auth';
import { fold } from '../../exam-rooms/matrix';

/** A matriz da prova no mock do gestor: as regras do backend (`/exam-rooms/{id}/matrix`), em memória. */
const matrices = new Map<number, any>();
const topicsBySubject = new Map<number, { id: number; name: string }[]>();
let nextTopic = 1;

const subjectOfRoom = (roomId: number): number | null => {
  const room = db['exam-rooms']?.find((r: any) => r.id === roomId);
  const statement = db.statements?.find((s: any) => s.id === room?.statementId);
  return statement?.subjectId ?? null;
};

function topicFor(subjectId: number | null, name: string) {
  const key = subjectId ?? 0;
  const list = topicsBySubject.get(key) ?? [];
  let found = list.find((t) => fold(t.name) === fold(name));
  if (!found) {
    found = { id: nextTopic++, name: name.trim() };
    list.push(found);
    topicsBySubject.set(key, list);
  }
  return found;
}

export async function matrixRoutes({ method, path, auth, isStaff, readBody }: MockContext): Promise<Response | undefined> {
  let m: RegExpMatchArray | null = null;
  if ((m = path.match(/^\/api\/v1\/subjects\/(\d+)\/topics$/)) && method === 'GET') {
    return json(200, (topicsBySubject.get(Number(m[1])) ?? []).map((t) => ({ ...t, subjectId: Number(m![1]), grade: null, keywords: null, questionCount: 0 })));
  }
  if (!(m = path.match(/^\/api\/v1\/exam-rooms\/(\d+)\/matrix$/))) return undefined;
  const roomId = Number(m[1]);
  if (!isStaff) return problem(403, 'Only teachers or ADMIN can manage the exam room matrix');
  // Só o dono da sala (ou o ADMIN) a vê: para os outros a sala não existe.
  const me = Number(auth.sub);
  const admin = (auth.roles ?? []).includes('ADMIN');
  if (!rooms.owned(me).some((r: any) => r.id === roomId) && !admin) return problem(404, 'Exam room not found');

  if (method === 'GET') {
    const found = matrices.get(roomId);
    return found ? json(200, found) : problem(404, 'Matrix not found');
  }
  if (method === 'DELETE') {
    matrices.delete(roomId);
    return json(204);
  }
  if (method === 'PUT') {
    const body = readBody();
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return problem(400, 'A matriz precisa de pelo menos um tema.');
    const total = Number(body.totalPoints ?? 20);
    const subjectId = subjectOfRoom(roomId);
    const seen = new Set<string>();
    const out: any[] = [];
    for (const item of items) {
      const name = String(item.topicName ?? '').trim();
      if (!name) return problem(400, 'Cada tema precisa de um nome.');
      if (seen.has(fold(name))) return problem(400, `O tema «${name}» está repetido.`);
      seen.add(fold(name));
      if (!Number.isInteger(item.questionCount) || item.questionCount < 1) return problem(400, `O tema «${name}» precisa de pelo menos 1 questão.`);
      const topic = topicFor(subjectId, name);
      out.push({ id: out.length + 1, topicId: topic.id, topicName: topic.name, questionCount: item.questionCount, points: item.points ?? null, cognitiveLevel: item.cognitiveLevel ?? null, questionTypes: null });
    }
    const withPoints = out.filter((i) => i.points != null);
    if (withPoints.length > 0) {
      const sum = withPoints.reduce((n, i) => n + i.points, 0);
      if (withPoints.length < out.length || Math.abs(sum - total) > 0.01) return problem(400, `As cotações somam ${sum} e a prova vale ${total}.`);
    }
    const matrix = { roomId, title: body.title ?? null, totalPoints: total, items: out };
    matrices.set(roomId, matrix);
    return json(200, matrix);
  }
  return problem(405, 'Method not allowed');
}
