'use server';

import { revalidatePath } from 'next/cache';
import { call, fail, guard, message, ok, type Result } from '@/lib/crud/http';
import type { Row } from '@/lib/crud/entities';

const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_OCR_FILE = 15 * 1024 * 1024;

export async function listQuestionImages(questionId: number): Promise<Result<Row[]>> {
  return guard(async () => {
    const res = await call(`/api/v1/question-images/question/${Number(questionId)}`);
    if (!res.ok) return fail(await message(res));
    return ok((await res.json()) as Row[]);
  });
}

/** multipart: `data` (JSON: questionId, caption, orderIndex) + `file`, exactly what QuestionImageController expects. */
export async function uploadQuestionImage(form: FormData): Promise<Result<Row>> {
  return guard(async () => {
    const file = form.get('file');
    const questionId = Number(form.get('questionId'));
    if (!(file instanceof File) || file.size === 0) return fail('Escolha uma imagem.');
    if (!file.type.startsWith('image/')) return fail('O ficheiro tem de ser uma imagem (PNG, JPG, WEBP…).');
    if (file.size > MAX_IMAGE) return fail('A imagem deve ter no máximo 5 MB.');
    if (!Number.isInteger(questionId) || questionId < 1) return fail('Questão inválida.');
    const out = new FormData();
    const orderIndex = form.get('orderIndex');
    out.append('data', new Blob([JSON.stringify({ questionId, caption: String(form.get('caption') ?? '').trim() || null, orderIndex: orderIndex === null || orderIndex === '' ? null : Number(orderIndex) })], { type: 'application/json' }));
    out.append('file', file, file.name);
    const res = await call('/api/v1/question-images', { method: 'POST', body: out });
    if (!res.ok) return fail(await message(res));
    return ok((await res.json()) as Row);
  });
}

export async function updateQuestionImage(id: number, questionId: number, caption: string, orderIndex: number | null): Promise<Result<Row>> {
  return guard(async () => {
    const res = await call(`/api/v1/question-images/${Number(id)}`, { method: 'PUT', body: JSON.stringify({ questionId, caption: caption.trim() || null, orderIndex }) });
    if (!res.ok) return fail(await message(res));
    return ok((await res.json()) as Row);
  });
}

export async function deleteQuestionImage(id: number): Promise<Result> {
  return guard(async () => {
    const res = await call(`/api/v1/question-images/${Number(id)}`, { method: 'DELETE' });
    if (!res.ok) return fail(await message(res));
    return ok(undefined);
  });
}

/** Sends one or more photos/scans of an exam to the OCR; the backend creates a statement waiting for review. */
export async function importStatementOcr(form: FormData): Promise<Result<Row>> {
  return guard(async () => {
    const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return fail('Escolha pelo menos um ficheiro.');
    if (files.length > 20) return fail('No máximo 20 ficheiros de cada vez.');
    for (const f of files) {
      if (!/^image\/|^application\/pdf$/.test(f.type)) return fail(`«${f.name}» não é uma imagem nem um PDF.`);
      if (f.size > MAX_OCR_FILE) return fail(`«${f.name}» ultrapassa os 15 MB.`);
    }
    const out = new FormData();
    for (const f of files) out.append('files', f, f.name);
    // FE-11: o OCR pode demorar com PDFs grandes; aborta aos 3 min com erro legível.
    const res = await call('/api/v1/statements/ocr/extract', { method: 'POST', body: out, signal: AbortSignal.timeout(180_000) });
    if (!res.ok) return fail(await message(res));
    revalidatePath('/statements');
    return ok((await res.json()) as Row);
  });
}
