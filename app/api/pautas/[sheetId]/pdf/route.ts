import { getCurrentUser } from '@/lib/auth.server';
import { call } from '@/lib/crud/http';
import { normalizeRoles } from '@/lib/roles';
import { isTimeout, timeoutSignal, TIMEOUT_MESSAGE } from '@/lib/timeout';
import { resolveSheetPlan } from '@/lib/term-sheet-export.server';
import { attachmentHeader, canExportSheets, exportClassFileName, exportErrorMessage, exportFileName, hasAssessmentResult, NO_RESULT } from '@/lib/term-sheet-export';

// O PDF da pauta, da pauta da turma (#627/#631) ou do resultado de uma prova, para professor, coordenador e ADMIN (#808). O browser não
// fala com o backend nem com o motor: esta rota junta o token do cookie, pede o PDF ao Kixi (que pede ao motor uma ligação
// curta, kixi#622) e devolve só os bytes. Nada fica guardado: nem o PDF, nem a ligação.

export const dynamic = 'force-dynamic';

/** O motor pode demorar a servir uma pauta grande: mais do que o prazo das leituras, sem ficar pendurado. */
const PDF_TIMEOUT_MS = 45_000;

const refuse = (status: number, error: string) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: Request, { params }: { params: Promise<{ sheetId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return refuse(401, exportErrorMessage(401));
  if (!canExportSheets(normalizeRoles(user.roles))) return refuse(403, exportErrorMessage(403));

  const { sheetId } = await params;
  const url = new URL(request.url);
  const prova = url.searchParams.get('prova');
  const tipo = url.searchParams.get('tipo');
  if (prova !== null && !/^\d{1,12}$/.test(prova)) return refuse(400, 'Prova inválida.');
  if (tipo !== null && tipo !== 'class') return refuse(400, 'Tipo de PDF inválido.');
  if (tipo === 'class' && prova !== null) return refuse(400, 'Escolha a pauta da turma ou o resultado de uma prova.');

  const resolved = await resolveSheetPlan(sheetId);
  if (!resolved.ok) return refuse(resolved.status, resolved.error);
  const { sheet, plan } = resolved;

  const assessment = prova === null ? null : plan.assessments.find((a) => a.id === Number(prova));
  if (prova !== null && !assessment) return refuse(404, 'Esta prova não pertence a esta pauta.');
  // A barreira do motor (409) continua a valer, mas uma prova sem nota nem devia chegar lá (#823).
  if (assessment && !hasAssessmentResult(assessment.status)) return refuse(409, NO_RESULT);
  const path = tipo === 'class'
    ? `/api/v1/term-plans/${plan.id}/reports/class`
    : assessment
      ? `/api/v1/term-plans/${plan.id}/assessments/${assessment.id}/reports/result`
      : `/api/v1/term-plans/${plan.id}/reports/mini-pauta`;

  let upstream: Response;
  try {
    upstream = await call(path, { headers: { Accept: 'application/pdf' }, signal: timeoutSignal(PDF_TIMEOUT_MS) });
  } catch (err) {
    return refuse(504, isTimeout(err) ? TIMEOUT_MESSAGE : exportErrorMessage(503));
  }
  if (!upstream.ok) return refuse(upstream.status, exportErrorMessage(upstream.status, await upstream.text().catch(() => '')));
  if (!(upstream.headers.get('content-type') ?? '').includes('application/pdf')) return refuse(502, exportErrorMessage(502));

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': attachmentHeader(tipo === 'class' ? exportClassFileName(sheet) : exportFileName(sheet, assessment)),
      // A pauta é dado pessoal dos alunos: nem o browser nem um proxy da escola a guardam.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
