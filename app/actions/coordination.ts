'use server';

// As salas da instituição para o coordenador (kixi#529), só em leitura, sobre `/api/v1/coordination/exam-rooms`.

import { call, fail, guard, message, ok, type Result } from '@/lib/crud/http';
import type { CoordinationGrade, CoordinationRoom } from '@/types/coordination';

const BASE = '/api/v1/coordination/exam-rooms';

async function json<T>(path: string): Promise<Result<T>> {
  const res = await call(path);
  if (!res.ok) return fail(await message(res));
  return ok((await res.json()) as T);
}

export async function coordinationRooms(): Promise<Result<CoordinationRoom[]>> {
  return guard(() => json<CoordinationRoom[]>(BASE));
}

/** Uma sala da instituição, a partir da lista que o backend já devolve (não há `GET` de uma só). */
export async function coordinationRoom(roomId: number): Promise<Result<CoordinationRoom>> {
  if (!Number.isInteger(roomId) || roomId <= 0) return fail('Sala inválida.');
  const rooms = await coordinationRooms();
  if (!rooms.ok) return rooms;
  const room = rooms.data.find((r) => r.id === roomId);
  return room ? ok(room) : fail('Sala não encontrada.');
}

export async function coordinationGrades(roomId: number): Promise<Result<CoordinationGrade[]>> {
  if (!Number.isInteger(roomId) || roomId <= 0) return fail('Sala inválida.');
  return guard(() => json<CoordinationGrade[]>(`${BASE}/${roomId}/grades`));
}
