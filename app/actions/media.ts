'use server';

import { call, fail, guard, message, ok, type Result } from '@/lib/crud/http';
import type { Row } from '@/lib/crud/entities';
import type { Figure } from '@/lib/exam/draft';

const MAX_IMAGE = 5 * 1024 * 1024;

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

/** Uma foto de perfil ou um logótipo escolhido do dispositivo: vai para o armazenamento e devolve o endereço que o
 *  formulário guarda em `photo`/`logo`. O servidor decide o que o ficheiro é pelos seus bytes; aqui só se poupa o envio
 *  do que já se vê que não serve. */
export async function uploadImage(form: FormData): Promise<Result<{ url: string }>> {
  return guard(async () => {
    const file = form.get('file');
    const kind = String(form.get('kind') ?? '');
    if (kind !== 'avatar' && kind !== 'logo') return fail('Tipo de imagem inválido.');
    if (!(file instanceof File) || file.size === 0) return fail('Escolha uma imagem.');
    if (!file.type.startsWith('image/')) return fail('O ficheiro tem de ser uma imagem (PNG, JPG ou WEBP).');
    if (file.size > 2 * 1024 * 1024) return fail('A imagem deve ter no máximo 2 MB.');
    const out = new FormData();
    out.append('file', file, file.name);
    const res = await call(`/api/v1/images?kind=${kind}`, { method: 'POST', body: out });
    if (!res.ok) return fail(await message(res));
    return ok((await res.json()) as { url: string });
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

const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

/**
 * Sends to their questions the figures the OCR cut out of the exam, once the exam exists.
 *
 * The draft only knows the number each question got (its position among the ones sent); the ids come
 * from the questions the server created. A figure that cannot be sent does not undo the exam: it is
 * counted in `failed` so the screen can say which were left out.
 */
export async function attachFigures(statementId: number, figures: Figure[]): Promise<{ attached: number; failed: number }> {
  if (figures.length === 0) return { attached: 0, failed: 0 };
  try {
    const listed = await call(`/api/v1/statements/${Number(statementId)}/questions`);
    if (!listed.ok) return { attached: 0, failed: figures.length };
    const questions = (await listed.json()) as { id: number; number?: number | null; parentId?: number | null }[];
    const idByNumber = new Map(questions.filter((q) => q.parentId == null && typeof q.number === 'number').map((q) => [q.number as number, q.id]));
    const sent = new Map<number, number>();
    let attached = 0;
    for (const figure of figures) {
      const questionId = idByNumber.get(figure.number);
      const match = DATA_URL.exec(figure.dataUrl);
      if (!questionId || !match) continue;
      const bytes = Buffer.from(match[2], 'base64');
      if (bytes.length === 0 || bytes.length > MAX_IMAGE) continue;
      const order = sent.get(questionId) ?? 0;
      const out = new FormData();
      out.append('data', new Blob([JSON.stringify({ questionId, caption: figure.caption.trim() || null, orderIndex: order })], { type: 'application/json' }));
      out.append('file', new Blob([bytes], { type: match[1] }), `questao-${figure.number}-${order + 1}.${match[1].split('/')[1]}`);
      const res = await call('/api/v1/question-images', { method: 'POST', body: out });
      if (res.ok) {
        attached += 1;
        sent.set(questionId, order + 1);
      }
    }
    return { attached, failed: figures.length - attached };
  } catch {
    return { attached: 0, failed: figures.length };
  }
}
