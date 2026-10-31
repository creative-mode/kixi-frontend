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

export async function coordinationGrades(roomId: number): Promise<Result<CoordinationGrade[]>> {
  if (!Number.isInteger(roomId) || roomId <= 0) return fail('Sala inválida.');
  return guard(() => json<CoordinationGrade[]>(`${BASE}/${roomId}/grades`));
}
