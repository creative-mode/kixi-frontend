/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
 
import crypto from 'node:crypto';
import { approvalProblem } from '../gate';
import { updateProblem } from '../statement-write';
import { buildQuestions } from '../manual-questions';
import { OGI_EXTRACTION } from '../ogi-extraction';
import { G, add, db, json, mapQuestion, mapStatement, mapStatementFull, markCorrect, missing, nextId, now, problem } from '../store';
import type { MockContext } from './auth';

/** Rotas do domínio «statements» do mock; devolve `undefined` quando o pedido não é deste domínio. */
export async function statementRoutes({ method, path, url, auth, isStaff, readBody, loginResponse, isAdmin, activeInst, writeWorld, denyWrite }: MockContext): Promise<Response | undefined> {
  let m: RegExpMatchArray | null = null;
  void [m, url, auth, isStaff, readBody, loginResponse, isAdmin, activeInst, writeWorld, denyWrite];
  // ── manual statements (exam builder) ──
  if (path === '/api/v1/statements/manual' && method === 'POST') {
    const b = readBody();
    const miss = missing(b, ['institutionId', 'subjectId', 'title', 'examType']);
    if (miss.length) return problem(400, `${miss.join(', ')} is required`);
    if (!Array.isArray(b.questions) || !b.questions.length) return problem(400, 'A statement needs at least one question');
    const inst = activeInst(b.institutionId);
    if (!inst) return problem(404, 'Institution not found');
    if (!isAdmin) {
      const t = db.teachers.find((x) => x.accountId === Number(auth.sub) && !x.deletedAt);
      if (!t) return problem(403, 'Only teachers can build statements');
      if (!db.institutionTeachers.some((l) => l.institutionId === inst.id && l.teacherId === t.id)) return problem(403, 'Teacher is not affiliated with this institution');
    }
    if (!db.institutionSubjects.some((l) => l.institutionId === inst.id && l.subjectId === Number(b.subjectId))) return problem(422, 'Subject is not taught by this institution');
    // Ids vêm da sequência global, como no backend. A versão anterior reiniciava a
    // contagem em cada enunciado, o que fazia dois enunciados diferentes terem
    // perguntas com o mesmo id — e `PUT /questions/{id}/correct-option`, que só leva
    // o id da pergunta, passava a resolver a pergunta do enunciado errado.
    // O contrato novo: `type` por questão e, num `group`, as alíneas em `items`.
    // A construção e as regras vivem em ./manual-questions.ts, onde se testam.
    if (b.durationMinutes != null && !(Number(b.durationMinutes) > 0)) return problem(400, 'The duration must be greater than zero');
    const built = buildQuestions(b.questions, () => nextId('questions'), () => nextId('options'));
    if (!built.ok) return problem(built.status, built.message);
    const questions = built.questions;
    const row = add('statements', {
      title: b.title, examType: b.examType, durationMinutes: b.durationMinutes ?? null, variant: b.variant ?? null, instructions: b.instructions ?? null,
      totalMaxScore: built.total, visible: !!b.visible, needsReview: false, source: 'manual',
      ocrConfidence: null, ocrRequestId: null, schoolYearId: b.schoolYearId ?? null, termId: b.termId ?? null, subjectId: Number(b.subjectId),
      classId: b.classId ?? null, courseId: b.courseId ?? null, institutionId: inst.id, questions,
    });
    for (const q of questions) {
      q.statementId = row.id;
      for (const o of q.options) o.questionId = q.id;
    }
    return json(201, mapStatement(row));
  }

  // ── statements (moderation) ──
  if (path === '/api/v1/statements/stats' && method === 'GET') {
    const act = db.statements.filter((s) => !s.deletedAt);
    return json(200, { total: act.length, needingReview: act.filter((s) => s.needsReview).length, fromOcr: act.filter((s) => s.source === 'OCR').length, visible: act.filter((s) => s.visible).length });
  }
  if (path === '/api/v1/statements' && method === 'GET') {
    return json(200, db.statements.filter((s) => !s.deletedAt && (isStaff || s.visible)).map(mapStatement));
  }
  for (const [p, f] of [['review', (s) => s.needsReview], ['from-ocr', (s) => s.source === 'OCR']]) {
    if (path === `/api/v1/statements/${p}` && method === 'GET') return json(200, db.statements.filter((s) => !s.deletedAt && f(s)).map(mapStatement));
  }
  if (path === '/api/v1/statements/trash' && method === 'GET') return json(200, db.statements.filter((s) => s.deletedAt).map(mapStatement));
  if ((m = path.match(/^\/api\/v1\/statements\/(\d+)(\/full|\/approve|\/visibility|\/restore|\/purge)?$/))) {
    const id = Number(m[1]);
    const s = db.statements.find((x) => x.id === id);
    const sub = m[2];
    if (!s) return problem(404, 'Statement not found');
    if (!sub && method === 'GET') return s.deletedAt || (!isStaff && !s.visible) ? problem(404, 'Statement not found') : json(200, mapStatement(s));
    if (sub === '/full' && method === 'GET') return s.deletedAt || (!isStaff && !s.visible) ? problem(404, 'Statement not found') : json(200, mapStatementFull(s, isStaff));
    if (!sub && method === 'DELETE') { s.deletedAt = now(); return json(204); }
    if (sub === '/restore' && method === 'POST') { s.deletedAt = null; return json(204); }
    if (sub === '/purge' && method === 'DELETE') { db.statements = db.statements.filter((x) => x.id !== id); return json(204); }
    if (sub === '/approve' && method === 'POST') {
      // O gate do BE-08, nas mesmas duas regras de `StatementService`: uma pergunta
      // com opções e sem resposta marcada, e um total que não bate com a soma.
      const blocked = approvalProblem(s);
      if (blocked) return problem(422, blocked);
      s.needsReview = false;
      return json(200, mapStatement(s));
    }
    if (sub === '/visibility' && method === 'PATCH') { s.visible = url.searchParams.get('visible') === 'true'; return json(200, mapStatement(s)); }
    // PUT do enunciado = StatementRequest: só metadados. As questões não vão aqui (o
    // backend descarta-as em silêncio) e têm as rotas de questão/opção abaixo.
    if (!sub && method === 'PUT') {
      if (s.deletedAt) return problem(404, 'Statement not found');
      const b = readBody();
      const numOrNull = (v) => (v == null || v === '' ? null : Number(v));
      if (b.institutionId == null) return problem(400, 'The institution is required');
      if (b.subjectId == null) return problem(400, 'The subject is required');
      const title = String(b.title ?? '').trim();
      if (title.length < 3 || title.length > 500) return problem(400, 'The title must be between 3 and 500 characters');
      if (!String(b.examType ?? '').trim()) return problem(400, 'The exam type is required');
      if (b.durationMinutes != null && !(Number(b.durationMinutes) > 0)) return problem(400, 'The duration must be greater than zero');
      if (b.totalMaxScore != null && !(Number(b.totalMaxScore) >= 0)) return problem(400, 'The total score cannot be negative');
      if (!db.subjects.find((x) => x.id === Number(b.subjectId) && !x.deletedAt)) return problem(404, 'Subject not found');
      if (b.classId != null && !db.classes.find((x) => x.id === Number(b.classId) && !x.deletedAt)) return problem(404, 'Class not found');
      // As regras do StatementService.update: turma obrigatória ao professor, quem pode
      // mexer neste enunciado, e se pode apontá-lo para esta escola, disciplina e turma.
      const blocked = updateProblem(writeWorld(), Number(auth.sub), isAdmin, s, {
        institutionId: Number(b.institutionId), subjectId: Number(b.subjectId), classId: numOrNull(b.classId),
      });
      if (blocked) return problem(blocked.status, blocked.message);
      Object.assign(s, {
        institutionId: Number(b.institutionId), subjectId: Number(b.subjectId), title, examType: String(b.examType).trim(),
        durationMinutes: numOrNull(b.durationMinutes), variant: b.variant || null, instructions: b.instructions || null,
        // Como o apply() do servidor: grava o que vier, e null apaga o total.
        totalMaxScore: numOrNull(b.totalMaxScore),
        schoolYearId: numOrNull(b.schoolYearId), termId: numOrNull(b.termId), classId: numOrNull(b.classId), courseId: numOrNull(b.courseId),
        updatedAt: now(),
      });
      return json(200, mapStatement(s));
    }
  }

  // ── questions (BE-08) ──
  if ((m = path.match(/^\/api\/v1\/statements\/(\d+)\/questions(?:\/(trash|reorder|\d+(?:\/(restore|purge))?))?$/))) {
    const s = db.statements.find((x) => x.id === Number(m[1]));
    if (!s) return problem(404, 'Statement not found');
    if (method !== 'GET') { const denied = denyWrite(s); if (denied) return denied; }
    const sub = m[2];
    const live = () => s.questions.filter((q) => !q.deletedAt).sort((a, b) => a.number - b.number);
    const nextNumber = () => Math.max(0, ...s.questions.map((q) => q.number)) + 1;

    if (!sub && method === 'GET') return json(200, live().map((q) => mapQuestion(q, s.id, isStaff)));
    if (sub === 'trash' && method === 'GET') return json(200, s.questions.filter((q) => q.deletedAt).map((q) => ({ ...q })));

    if (sub === 'reorder' && method === 'PUT') {
      // `QuestionReorderRequest` tem de nomear todas as perguntas activas, uma vez
      // cada: mais curto deixa perguntas numa ordem que ninguém escolheu, mais longo
      // nomeia uma que não lá está. Ambos são recusados em vez de adivinhados.
      const b = readBody();
      const ids = b.questionIds;
      if (!Array.isArray(ids) || ids.length === 0) return problem(400, 'The list of question ids is required');
      const current = live();
      if (ids.length !== current.length || new Set(ids).size !== ids.length || ids.some((id) => !current.some((q) => q.id === Number(id)))) {
        return problem(422, 'The reorder must name every active question of the statement exactly once');
      }
      ids.forEach((id, i) => { const q = current.find((x) => x.id === Number(id)); q.orderIndex = i; });
      current.forEach((q, i) => { q.number = i + 1; });
      return json(200, live().map((q) => ({ ...q })));
    }

    if (sub && /^\d+$/.test(sub) && method === 'GET') {
      const q = s.questions.find((x) => x.id === Number(sub));
      if (!q || q.deletedAt) return problem(404, 'Question not found');
      return json(200, { ...q });
    }

    if (!sub && method === 'POST') {
      const b = readBody();
      if (!b.text || !String(b.text).trim()) return problem(400, 'The question text is required');
      // `QuestionRequest.maxScore` é @NotNull, e a razão está escrita no DTO: uma
      // edição que o omita guardaria NULL, encolheria a soma em silêncio e deixaria
      // o enunciado impossível de aprovar — devolvendo 200 à edição que o fez.
      if (b.maxScore == null) return problem(400, 'The question score is required');
      const q = { id: nextId('questions'), statementId: s.id, number: nextNumber(), text: String(b.text).trim(), questionType: b.questionType ?? 'open', maxScore: Number(b.maxScore), orderIndex: live().length, pageIndex: b.pageIndex ?? null, modelAnswer: b.modelAnswer ?? null, needsReview: false, options: [] };
      s.questions.push(q);
      return json(201, { ...q });
    }

    if (sub && /^\d+$/.test(sub)) {
      const q = s.questions.find((x) => x.id === Number(sub));
      if (!q || q.deletedAt) return problem(404, 'Question not found');
      if (method === 'DELETE') { q.deletedAt = now(); return json(204); }
      if (method === 'PUT') {
        const b = readBody();
        if (b.text != null && !String(b.text).trim()) return problem(400, 'The question text is required');
        // Omitir a cotação também viola o @NotNull: um PUT que a omita guardaria
        // NULL, encolheria a soma em silêncio e deixaria o enunciado impossível de
        // aprovar para sempre — com a edição que o fez a devolver 200.
        if (!Object.keys(b).includes('maxScore')) return problem(400, 'The question score is required');
        if (b.maxScore === null) return problem(400, 'The question score is required');
        if (b.text != null) q.text = String(b.text).trim();
        if (b.maxScore != null) q.maxScore = Number(b.maxScore);
        if (b.questionType != null) q.questionType = b.questionType;
        if (b.pageIndex != null) q.pageIndex = Number(b.pageIndex);
        // Como o setModelAnswer(blankToNull(...)) do servidor: vazio ou null apaga.
        if ('modelAnswer' in b) q.modelAnswer = b.modelAnswer && String(b.modelAnswer).trim() ? String(b.modelAnswer) : null;
        return json(200, { ...q });
      }
    }
  }

  // ── question options (BE-08) ──
  if ((m = path.match(/^\/api\/v1\/statements\/(\d+)\/questions\/(\d+)\/options(?:\/(trash|reorder|\d+(?:\/(restore|purge))?))?$/))) {
    const s = db.statements.find((x) => x.id === Number(m[1]));
    const q = s?.questions.find((x) => x.id === Number(m[2]) && !x.deletedAt);
    if (!s || !q) return problem(404, 'Question not found');
    if (method !== 'GET') { const denied = denyWrite(s); if (denied) return denied; }
    const sub = m[3];
    q.options ??= [];
    const liveOpts = () => q.options.filter((o) => !o.deletedAt).sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    const nextOrder = () => liveOpts().length;

    if (!sub && method === 'GET') return json(200, liveOpts().map((o) => ({ ...o })));
    if (sub === 'trash' && method === 'GET') return json(200, q.options.filter((o) => o.deletedAt).map((o) => ({ ...o })));

    if (sub === 'reorder' && method === 'PUT') {
      const b = readBody();
      const ids = b.optionIds;
      if (!Array.isArray(ids) || ids.length === 0) return problem(400, 'The list of option ids is required');
      const current = liveOpts();
      if (ids.length !== current.length || new Set(ids).size !== ids.length || ids.some((id) => !current.some((o) => o.id === Number(id)))) {
        return problem(422, 'The reorder must name every active option of the question exactly once');
      }
      ids.forEach((id, i) => { const o = current.find((x) => x.id === Number(id)); o.orderIndex = i; });
      return json(200, liveOpts().map((o) => ({ ...o })));
    }

    if (sub && /^\d+$/.test(sub) && method === 'GET') {
      const o = q.options.find((x) => x.id === Number(sub));
      if (!o || o.deletedAt) return problem(404, 'Option not found');
      return json(200, { ...o });
    }

    if (!sub && method === 'POST') {
      const b = readBody();
      if (!b.optionLabel || !String(b.optionLabel).trim()) return problem(400, 'The option label is required');
      if (!b.optionText || !String(b.optionText).trim()) return problem(400, 'The option text is required');
      // `optionLabel` é identidade única por pergunta e o índice não conhece as linhas
      // removidas: uma etiqueta fica tomada para sempre. `isCorrect` passa pelo mesmo
      // rewrite na criação e na edição, para a resposta se manter singular.
      const label = String(b.optionLabel).trim();
      if (q.options.some((o) => o.optionLabel === label && !o.deletedAt)) return problem(409, `The option label ${label} is already used in this question`);
      const o = { id: nextId('options'), questionId: q.id, optionLabel: label, optionText: String(b.optionText).trim(), isCorrect: false, orderIndex: nextOrder() };
      q.options.push(o);
      return json(201, b.isCorrect ? markCorrect(q, o.id) : { ...o });
    }

    if (sub && /^\d+$/.test(sub)) {
      const o = q.options.find((x) => x.id === Number(sub));
      if (!o || o.deletedAt) return problem(404, 'Option not found');
      if (method === 'PUT') {
        const b = readBody();
        if (!b.optionText || !String(b.optionText).trim()) return problem(400, 'The option text is required');
        o.optionText = String(b.optionText).trim();
        // `isCorrect` é honrado na edição também. Já só era honrado na criação e
        // descartado em silêncio no PUT: o corpo pedia a opção correcta, recebia
        // um 200, e nada mudava.
        if (b.isCorrect) markCorrect(q, o.id);
        return json(200, { ...o });
      }
      if (method === 'DELETE') { o.deletedAt = now(); return json(204); }
    }
  }

  // ── correct option (BE-08) ──
  if ((m = path.match(/^\/api\/v1\/questions\/(\d+)\/correct-option$/)) && method === 'PUT') {
    const b = readBody();
    if (!b.optionId) return problem(400, 'The option id is required');
    const q = db.statements.flatMap((s) => s.questions).find((x) => x.id === Number(m[1]) && !x.deletedAt);
    if (!q) return problem(404, 'Question not found');
    const denied = denyWrite(db.statements.find((x) => x.questions.includes(q)));
    if (denied) return denied;
    const o = (q.options ?? []).find((x) => x.id === Number(b.optionId) && !x.deletedAt);
    // A opção tem de pertencer à pergunta do path: o query que a marca reescreve
    // is_correct em todas as opções dessa pergunta, e um id estrangeiro deixaria a
    // pergunta sem resposta nenhuma em vez de falhar.
    if (!o) return problem(404, 'Option not found');
    return json(200, markCorrect(q, o.id));
  }

  // ── question images (multipart upload) ──
  if ((m = path.match(/^\/api\/v1\/question-images\/question\/(\d+)$/)) && method === 'GET') {
    return json(200, db['question-images'].filter((i) => !i.deletedAt && i.questionId === Number(m[1])).sort((a, b) => a.orderIndex - b.orderIndex));
  }
  if (path === '/api/v1/question-images' && method === 'POST') {
    const b = readBody();
    const d = b.data ?? {};
    const f = Array.isArray(b.file) ? b.file[0] : b.file;
    if (!d.questionId) return problem(400, 'Question ID is required');
    if (!f?.dataUrl) return problem(400, 'Image file is required (max 1,5 MB in the mock)');
    if (!String(f.type).startsWith('image/')) return problem(400, 'Only image files are accepted');
    const order = d.orderIndex ?? db['question-images'].filter((i) => !i.deletedAt && i.questionId === d.questionId).length;
    return json(201, add('question-images', { questionId: d.questionId, imageUrl: f.dataUrl, caption: d.caption ?? null, orderIndex: order }));
  }
  if ((m = path.match(/^\/api\/v1\/question-images\/(\d+)$/)) && ['PUT', 'DELETE', 'GET'].includes(method)) {
    const img = db['question-images'].find((i) => i.id === Number(m[1]) && !i.deletedAt);
    if (!img) return problem(404, 'Question image not found');
    if (method === 'GET') return json(200, img);
    if (method === 'DELETE') { img.deletedAt = now(); return json(204); }
    const b = readBody();
    Object.assign(img, { caption: b.caption ?? null, orderIndex: b.orderIndex ?? img.orderIndex, updatedAt: now() });
    return json(200, img);
  }

  // ── OCR: extração estruturada, sem persistir (alimenta o construtor de provas) ──
  // O mock não corre o motor: responde com uma prova sintética para jornadas locais.
  if (path === '/api/v1/ocr/jobs' && method === 'POST') {
    const b = readBody();
    const files = [b.files ?? b.file].flat().filter(Boolean);
    if (!files.length) return problem(400, 'At least one file is required');
    const jobId = crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const extraction = {
      ...OGI_EXTRACTION,
      request_id: `req-${requestId}`,
      processing_time_ms: 1200,
      questions: OGI_EXTRACTION.questions?.map((question, index) => index === 0 ? {
        ...question,
        text: 'Questão sintética para validação matemática: determine $v = v_0 + at$.',
        formulas: [{ raw: 'v = v_0 + at', latex: 'v = v_0 + at', confidence: 0.98, kind: 'formula' }],
      } : question),
      images_to_upload: [{
        region: 'questao_1', description: 'Diagrama OCR', kind: 'figure',
        data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ7sAAAAASUVORK5CYII=',
      }],
    };
    G.__kixiMock.ocrJobs.set(jobId, { accountId: String(auth.sub), polls: 0, result: extraction, cancelled: false });
    return json(202, { jobId, requestId, status: 'QUEUED', statusUrl: `/api/v1/ocr/jobs/${jobId}` });
  }
  if ((m = path.match(/^\/api\/v1\/ocr\/jobs\/([0-9a-f-]{36})$/i)) && method === 'GET') {
    const job = G.__kixiMock.ocrJobs.get(m[1]);
    if (!job || job.accountId !== String(auth.sub)) return problem(404, 'OCR job not found');
    if (job.cancelled) return json(200, { jobId: m[1], requestId: null, status: 'CANCELLED', pageCount: 0, completedPages: 0, currentPage: 0, eventType: 'error', result: null, error: 'Import cancelled' });
    job.polls += 1;
    if (job.polls < 3) return json(200, { jobId: m[1], requestId: null, status: 'PROCESSING', pageCount: 1, completedPages: job.polls - 1, currentPage: 1, eventType: job.polls === 1 ? 'rasterized' : 'progress', result: null, error: null });
    return json(200, { jobId: m[1], requestId: null, status: 'SUCCEEDED', pageCount: 1, completedPages: 1, currentPage: 1, eventType: 'result', result: job.result, error: null });
  }
  if ((m = path.match(/^\/api\/v1\/ocr\/jobs\/([0-9a-f-]{36})$/i)) && method === 'DELETE') {
    const job = G.__kixiMock.ocrJobs.get(m[1]);
    if (!job || job.accountId !== String(auth.sub)) return problem(404, 'OCR job not found');
    job.cancelled = true;
    return json(204);
  }
  if (path === '/api/v1/ocr/extract/stream' && method === 'POST') {
    const b = readBody();
    const files = [b.files ?? b.file].flat().filter(Boolean);
    if (!files.length) return problem(400, 'At least one file is required');
    const extraction = {
      ...OGI_EXTRACTION,
      request_id: `req-${Date.now()}`,
      processing_time_ms: 1200,
      questions: OGI_EXTRACTION.questions?.map((question, index) => index === 0 ? {
        ...question,
        text: 'Questão sintética para validação matemática: determine $v = v_0 + at$.',
        formulas: [{ raw: 'v = v_0 + at', latex: 'v = v_0 + at', confidence: 0.98, kind: 'formula' }],
      } : question),
      images_to_upload: [{
        region: 'questao_1', description: 'Diagrama OCR', kind: 'figure',
        data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ7sAAAAASUVORK5CYII=',
      }],
    };
    const events = [
      `event: prepared\ndata: ${JSON.stringify({ requestId: extraction.request_id, pageCount: 1, timings: { uploadMs: 1, preparationMs: 1, rasterizationMs: 0 } })}\n\n`,
      `event: progress\ndata: ${JSON.stringify({ page: 1, pageCount: 1, timings: { preprocessingMs: 1, ocrMs: 1, parsingMs: 1, totalMs: 3 } })}\n\n`,
      `event: result\ndata: ${JSON.stringify({ ...extraction, timings: { ocrMs: 1, parsingMs: 1, responseAssemblyMs: 1, totalMs: 3 } })}\n\n`,
    ];
    const encoder = new TextEncoder();
    let index = 0;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = () => {
          controller.enqueue(encoder.encode(events[index++]));
          if (index === events.length) controller.close();
          else setTimeout(send, 200);
        };
        setTimeout(send, 50);
      },
    });
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform' },
    });
  }
  // Legacy response kept for older local tests and clients.
  if (path === '/api/v1/ocr/extract/exam' && method === 'POST') {
    const b = readBody();
    const files = [b.files ?? b.file].flat().filter(Boolean);
    if (!files.length) return problem(400, 'At least one file is required');
    return json(200, { ...OGI_EXTRACTION, request_id: `req-${Date.now()}`, processing_time_ms: 1200 });
  }

  // ── OCR import: creates a statement waiting for review ──
  if ((path === '/api/v1/statements/ocr/extract' || path === '/api/v1/statements/ocr/extract/single') && method === 'POST') {
    const b = readBody();
    const files = [b.files ?? b.file].flat().filter(Boolean);
    if (!files.length) return problem(400, 'At least one file is required');
    const title = String(files[0].name ?? 'Prova importada').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Prova importada';
    const sy = db['school-years'][0];
    const s = add('statements', {
      title, examType: 'P1', durationMinutes: 60, variant: null, instructions: null, totalMaxScore: 6, visible: false, needsReview: true,
      source: 'OCR', ocrConfidence: 0.82, ocrRequestId: `req-${Date.now()}`, schoolYearId: sy?.id ?? null, termId: null, subjectId: null, classId: null,
      questions: [1, 2, 3].map((n) => ({ id: 1000 + nextId('questions'), number: n, questionType: 'MULTIPLE_CHOICE', text: `Questão ${n} extraída de ${files.length} ficheiro(s). Reveja o texto.`, maxScore: 2, needsReview: true, options: ['A', 'B', 'C', 'D'].map((l, i) => ({ id: 1000 + nextId('options'), optionLabel: l, optionText: `Opção ${l}`, isCorrect: i === 0 })) })),
    });
    return json(201, s);
  }

  return undefined;
}
