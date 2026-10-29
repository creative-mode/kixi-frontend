import { toLocalDateTime, type MockQuestion } from '../simulation';

import { turmaDoCodigo, validarCodigoDeMatricula, type EnrollmentCode } from '../enrollment-codes';
import type { Enrollment } from '@/lib/types';
import { QUESTIONS_BY_STATEMENT, classResponse, json, problem, statementSummary, tutorSources, validationError } from '../store';
import type { MockCtx } from '../store';

/** Rotas do domínio «tutor» do mock; devolve `undefined` quando o pedido não é deste domínio. */
export async function tutorRoutes({ method, pathname, search, filter, body, text, accountId, account, staff, db }: MockCtx): Promise<Response | undefined> {
  void [method, pathname, search, filter, body, text, accountId, account, staff, db];
  // ── o tutor (BE-18 e BE-19) ───────────────────────────────────────────────────
  // POST /chat/sessions abre uma sessão presa a um enunciado que o aluno pode ler;
  // POST /chat/sessions/{id}/messages responde em text/event-stream: `delta`s, depois
  // `final`. Tudo o que falha ANTES do primeiro byte é um estado HTTP normal (404 de uma
  // sessão alheia, 429 + Retry-After, 503); depois só há um evento `error` na própria
  // stream. O texto da mensagem escolhe o caso, para o fluxo de integração os exercitar.
  if (pathname === '/chat/sessions' && method === 'POST') {
    const statementId = Number(body.statementId);
    if (!Number.isInteger(statementId) || statementId <= 0) {
      return validationError({ statementId: 'statementId is required' });
    }
    const statement = db.statements.find((x) => x.id === statementId);
    if (!statement || (!staff && !statement.visible)) return problem(404, 'Statement not found');
    const rawMode = body.mode ?? null;
    const allowedModes = ['GENERAL', 'EXPLAIN_QUESTION', 'SIMILAR_EXERCISES', 'CONCEPT'];
    if (rawMode !== null && !allowedModes.includes(String(rawMode))) {
      return validationError({ mode: 'mode must be a known tutor mode' });
    }
    const mode = (rawMode === null ? 'GENERAL' : String(rawMode)) as 'GENERAL' | 'EXPLAIN_QUESTION' | 'SIMILAR_EXERCISES' | 'CONCEPT';
    const rawQuestionId = body.questionId ?? null;
    if (rawQuestionId !== null && (!Number.isInteger(Number(rawQuestionId)) || Number(rawQuestionId) <= 0)) {
      return validationError({ questionId: 'questionId must be positive' });
    }
    const questionId = rawQuestionId === null ? null : Number(rawQuestionId);
    if ((mode === 'EXPLAIN_QUESTION' || mode === 'SIMILAR_EXERCISES') && questionId === null) {
      return validationError({ questionId: 'questionId is required for this mode' });
    }
    const askedQuestion =
      questionId === null
        ? null
        : db.questions.find((q) => q.id === questionId && (QUESTIONS_BY_STATEMENT[statementId] ?? []).includes(q.id)) ?? null;
    if (questionId !== null && !askedQuestion) return problem(404, 'Question is not part of this statement.');
    const rawSelectedOptionId = body.selectedOptionId ?? null;
    if (rawSelectedOptionId !== null && (!Number.isInteger(Number(rawSelectedOptionId)) || Number(rawSelectedOptionId) <= 0)) {
      return validationError({ selectedOptionId: 'selectedOptionId must be positive' });
    }
    const selectedOptionId = rawSelectedOptionId === null ? null : Number(rawSelectedOptionId);
    const studentAnswer = body.studentAnswer === undefined || body.studentAnswer === null ? null : String(body.studentAnswer);
    if (studentAnswer !== null && studentAnswer.length > 2000) {
      return validationError({ studentAnswer: 'studentAnswer must be at most 2000 characters' });
    }
    if ((selectedOptionId !== null || studentAnswer !== null) && questionId === null) {
      return validationError({ questionId: 'questionId is required when an answer is provided' });
    }
    const session = {
      id: db.chatSessions.length + 1,
      accountId: account.id,
      statementId,
      mode,
      questionId,
      selectedOptionId,
      studentAnswer,
    };
    db.chatSessions.push(session);
    return json({ id: session.id, statementId, mode, questionId, sources: tutorSources(statement, askedQuestion, mode), createdAt: toLocalDateTime(new Date()) }, 201);
  }

  const chatMatch = /^\/chat\/sessions\/(\d+)\/messages$/.exec(pathname);
  if (chatMatch && method === 'POST') {
    const session = db.chatSessions.find((x) => x.id === Number(chatMatch[1]) && x.accountId === account.id);
    // Uma sessão alheia é 404, não 403: não se revela que existe.
    if (!session) return problem(404, 'Chat session not found');
    const content = text('content');
    if (!content) return validationError({ content: 'content is required' });
    if (content.length > 4000) return validationError({ content: 'content must be at most 4000 characters' });
    if (content.includes('[[sem-chave]]')) return problem(503, 'The AI provider is not configured');
    const extra = Object.keys(body).filter((key) => key !== 'content');
    if (extra.length > 0) return validationError({ content: 'message endpoint only accepts content' });

    db.chatSent[account.id] = (db.chatSent[account.id] ?? 0) + 1;
    if (content.includes('[[limite]]') || db.chatSent[account.id] > 30) {
      return new Response(
        JSON.stringify({ type: null, title: 'Too Many Requests', status: 429, detail: 'Too many tutor messages. Try again later.', properties: { code: 'CHAT_RATE_LIMITED' } }),
        { status: 429, headers: { 'Content-Type': 'application/problem+json', 'Retry-After': '90' } },
      );
    }

    const statement = db.statements.find((x) => x.id === session.statementId);
    const askedQuestion =
      session.questionId == null
        ? null
        : db.questions.find((q) => q.id === session.questionId && (QUESTIONS_BY_STATEMENT[session.statementId] ?? []).includes(q.id)) ?? null;
    const reply = content.includes('[[fora]]')
      ? 'Só acompanho o enunciado desta sessão, por isso não consigo ajudar com esse assunto.'
      : `Vamos por passos, sobre «${statement?.title ?? 'esta prova'}». Primeiro, identifica o que a questão pede. Depois, aplica a regra e confirma o resultado: a escolha final é tua.`;
    const pieces = reply.match(/\S+\s*/g) ?? [reply];
    const broken = content.includes('[[erro]]');
    const encoder = new TextEncoder();
    const sse = (type: string, payload: object) =>
      encoder.encode(`event: ${type}\ndata: ${JSON.stringify({ type, ...payload })}\n\n`);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const [i, piece] of pieces.entries()) {
          if (broken && i === 3) {
            controller.enqueue(sse('error', { code: 'CHAT_PROVIDER_TIMEOUT', message: 'Provider timed out' }));
            controller.close();
            return;
          }
          controller.enqueue(sse('delta', { content: piece }));
          await new Promise((resolve) => setTimeout(resolve, 15));
        }
        controller.enqueue(sse('final', {
          messageId: db.chatSent[account.id],
          model: 'mock',
          sources: tutorSources(statement, askedQuestion, session.mode),
        }));
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  }

  const fullMatch = /^\/statements\/(\d+)\/full$/.exec(pathname);
  if (fullMatch && method === 'GET') {
    const statement = db.statements.find((s) => s.id === Number(fullMatch[1]));
    if (!statement) return problem(404, 'Statement not found');
    // Um aluno só lê o enunciado publicado (StatementController.java:135). O mock
    // devolve 404 como o backend, para o cartão não abrir uma prova invisível.
    if (!staff && !statement.visible) return problem(404, 'Statement not found');

    const ids = QUESTIONS_BY_STATEMENT[statement.id] ?? [];
    const questions = ids
      .map((qid) => db.questions.find((q) => q.id === qid))
      .filter((q): q is MockQuestion => q !== undefined)
      .map((q) => {
      // O gabarito viaja só com quem é staff (StatementOcrResponse.java:166-173),
      // e o `@JsonInclude(NON_NULL)` tira o campo do JSON em vez de o mandar a
      // null. O mesmo para `modelAnswer`, que nem existe neste DTO. Um mock que
      // mandasse `isCorrect` ao aluno ensinaria a sala a ler o gabarito — e a sala
      // a mostrar a resposta certa antes de entregar.
      const body = {
        ...q,
        needsReview: staff ? false : undefined,
        ocrConfidence: staff ? 0.98 : undefined,
      };
      return {
        ...body,
        options: q.options.map((o) => ({
          id: o.id,
          optionLabel: o.optionLabel,
          optionText: o.optionText,
          orderIndex: o.orderIndex,
          ...(staff ? { isCorrect: o.isCorrect, ocrConfidence: 0.98 } : {}),
        })),
      };
    });
    return json({
      ...statementSummary(db, statement),
      needsReview: staff ? false : undefined,
      ocrConfidence: staff ? 0.98 : undefined,
      questions,
    });
  }

  const imagesMatch = /^\/question-images\/question\/(\d+)$/.exec(pathname);
  if (imagesMatch && method === 'GET') {
    const questionId = Number(imagesMatch[1]);
    // Uma imagem por questão, para se ver o caminho que a sala percorre. As URLs
    // são do armazenamento do backend; aqui são locais, o resto do contrato é igual.
    return json(
      questionId === 1
        ? [
            {
              id: 1,
              questionId,
              imageUrl: "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 80'%3E%3Crect width='320' height='80' fill='%23eef'/%3E%3Ctext x='160' y='47' text-anchor='middle' font-family='sans-serif' font-size='18'%3E192.168.1.0/29%3C/text%3E%3C/svg%3E",
              caption: 'Divisão de um endereço em rede e host',
              orderIndex: 0,
              createdAt: null,
              updatedAt: null,
              deletedAt: null,
            },
          ]
        : [],
    );
  }

  if (pathname === '/courses' && method === 'GET') {
    const institutionId = filter('institutionId');
    return json(
      institutionId === undefined
        ? db.courses
        : db.courses.filter((course) => course.institutionId === institutionId),
    );
  }

  if (pathname === '/school-years' && method === 'GET') {
    // Sem ordem: o backend devolve o que a base de dados der, e `lib/school-year.ts`
    // ordena do lado do cliente. Ordenar aqui esconderia isso.
    return json(db.schoolYears);
  }

  if (pathname === '/classes' && method === 'GET') {
    const institutionId = filter('institutionId');
    const courseId = filter('courseId');
    const rows = db.classes.filter((row) => {
      if (institutionId !== undefined && row.institutionId !== institutionId) return false;
      if (courseId !== undefined && row.courseId !== courseId) return false;
      return true;
    });
    return json(rows.map((row) => classResponse(db, row)));
  }

  if (pathname === '/enrollments' && method === 'GET') {
    const requested = search.get('accountId');
    const visible = requested ? db.enrollments.filter((e) => e.accountId === Number(requested)) : db.enrollments;
    return json(staff ? visible : visible.filter((e) => e.accountId === account.id));
  }

  if (pathname === '/enrollments' && method === 'POST') {
    const target = body.accountId === undefined || body.accountId === null
      ? account.id
      : Number(body.accountId);
    if (target !== account.id && !staff) {
      return problem(403, 'Only ADMIN or TEACHER can enroll another account');
    }
    const targetAccount = db.accounts.find((a) => a.id === target);
    if (!targetAccount || !targetAccount.active) return problem(404, 'Account not found');

    // Auto-matrícula (kixi#255): quem se matricula a si próprio — mesmo sendo ADMIN ou
    // TEACHER — precisa de um código. A matrícula de outra conta por staff continua a
    // indicar a turma e o ano, como no EnrollmentService.
    const selfEnroll = target === account.id;
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const missing: Record<string, string> = {};
    if (selfEnroll) {
      if (!code) missing.code = 'An enrollment code is required';
    } else {
      if (!Number.isInteger(Number(body.classId))) missing.classId = 'Class is required';
      if (!Number.isInteger(Number(body.schoolYearId))) missing.schoolYearId = 'School year is required';
    }
    if (Object.keys(missing).length) return validationError(missing);

    let codeEntry: EnrollmentCode | undefined;
    if (selfEnroll) {
      const validacao = validarCodigoDeMatricula(db.enrollmentCodes, code, new Date());
      if (!validacao.ok) return problem(validacao.status, validacao.detail);
      codeEntry = validacao.entry;
      // Como o backend, o uso é reservado antes de procurar uma matrícula activa: um
      // 409 também gasta o código (EnrollmentService#enroll redime primeiro).
      codeEntry.uses++;
    }

    // O código manda: o classId/schoolYearId do corpo são ignorados na auto-matrícula,
    // para um aluno não poder escolher a turma que lhe apetece (kixi#255).
    const resolvida = selfEnroll
      ? turmaDoCodigo(codeEntry!, db.classes)
      : { classId: Number(body.classId), schoolYearId: Number(body.schoolYearId) };
    if (!resolvida) return problem(404, 'Class not found');
    const { classId, schoolYearId } = resolvida;
    if (!selfEnroll) {
      const row = db.classes.find((c) => c.id === classId);
      if (!row) return problem(404, 'Class not found');
      if (row.schoolYearId !== schoolYearId) {
        return problem(400, 'Class does not belong to the given school year');
      }
    }
    if (!db.schoolYears.some((y) => y.id === schoolYearId)) {
      return problem(404, 'School year not found');
    }
    const active = db.enrollments.find(
      (e) => e.accountId === target && e.schoolYearId === schoolYearId && e.status === 'ACTIVE',
    );
    if (active) {
      return problem(409, 'Account already has an active enrollment for this school year');
    }

    const enrollment: Enrollment = {
      id: db.nextEnrollment++,
      accountId: target,
      classId,
      schoolYearId,
      status: 'ACTIVE',
    };
    db.enrollments.push(enrollment);
    return json(enrollment, 201);
  }

  return undefined;
}
