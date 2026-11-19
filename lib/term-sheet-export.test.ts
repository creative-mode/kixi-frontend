// Exportar a pauta em PDF (kixi-frontend#808):  node --test lib/term-sheet-export.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachmentHeader,
  canExportSheets,
  exportableAssessments,
  exportBlockedReason,
  exportErrorMessage,
  exportFileName,
  fileNameFrom,
  hasAssessmentResult,
  isProvisional,
  NO_PDF_YET,
  NO_RESULT,
  NO_STATEMENT,
  planForSheet,
  slug,
} from './term-sheet-export.ts';

const sheet = { sheetId: 'PT-1', status: 'FECHADA' as const, termNumber: 1, schoolYear: '2025/2026', classId: 7, className: 'B', grade: 12, subjectId: 3, subjectName: 'Redes de Computadores' };
const plan = (over: Record<string, unknown>) => ({ id: 1, classId: 7, subjectId: 3, termNumber: 1, pautaRef: null as string | null, ...over });

test('o botão é do professor, do coordenador e do ADMIN; o aluno não o vê', () => {
  assert.equal(canExportSheets(['TEACHER']), true);
  assert.equal(canExportSheets(['COORDINATOR']), true);
  assert.equal(canExportSheets(['ADMIN']), true);
  assert.equal(canExportSheets(['STUDENT']), false);
  assert.equal(canExportSheets([]), false);
});

test('a pauta anulada fica com o botão desativado e o motivo; as outras não', () => {
  assert.match(exportBlockedReason({ status: 'ANULADA' }) ?? '', /anulada/);
  assert.equal(exportBlockedReason({ status: 'FECHADA' }), null);
  assert.equal(exportBlockedReason({ status: 'REGISTADA' }), null);
  assert.equal(isProvisional({ status: 'REGISTADA' }), true);
  assert.equal(isProvisional({ status: 'FECHADA' }), false);
});

test('o plano da pauta é o que a abriu no motor, mesmo com outro trimestre ao lado', () => {
  const plans = [plan({ id: 1, termNumber: 1 }), plan({ id: 2, termNumber: 1, pautaRef: 'PT-1' })];
  assert.equal(planForSheet(sheet, plans)?.id, 2);
});

test('sem pautaRef, vale o único plano da turma, disciplina e trimestre', () => {
  assert.equal(planForSheet(sheet, [plan({ id: 4, termNumber: 2 }), plan({ id: 5, termNumber: 1 })])?.id, 5);
  assert.equal(planForSheet(sheet, [plan({ id: 6, subjectId: 99 })]), null, 'outra disciplina não serve');
  assert.equal(planForSheet(sheet, [plan({ id: 8, classId: 99 })]), null, 'outra turma não serve');
});

test('na dúvida não se adivinha: dois planos do mesmo trimestre sem pautaRef dão nenhum', () => {
  assert.equal(planForSheet(sheet, [plan({ id: 1 }), plan({ id: 2 })]), null);
  assert.equal(planForSheet(sheet, []), null);
});

test('só as provas corrigidas com enunciado têm resultado, MAC primeiro e depois P1 e P2', () => {
  const a = (kind: 'P1' | 'P2' | 'MAC', seq: number, statementId: number | null, status = 'GRADED') => ({ kind, seq, statementId, status }) as never;
  const out = exportableAssessments([
    a('P2', 1, 9), a('MAC', 2, 4, 'DONE'), a('P1', 1, 8), a('MAC', 1, 3), a('MAC', 3, null),
    a('P1', 2, 5, 'DISPENSED'), a('P2', 2, 11, 'ROOM_OPEN'),
  ]);
  assert.deepEqual(out.map((x: { kind: string; seq: number }) => `${x.kind}${x.seq}`), ['MAC1', 'MAC2', 'P11', 'P21']);
});

test('sem correção não há resultado para oferecer nem para pedir ao motor (#823)', () => {
  const a = (status: string) => ({ kind: 'P1' as const, seq: 1, statementId: 7, status }) as never;
  assert.equal(hasAssessmentResult('DONE'), true);
  assert.equal(hasAssessmentResult('GRADED'), true);
  for (const status of ['PLANNED', 'STATEMENT_READY', 'ROOM_OPEN', 'DISPENSED'] as const) {
    assert.equal(hasAssessmentResult(status), false, status);
    assert.equal(exportableAssessments([a(status)]).length, 0, `${status} não tem nota`);
  }
  assert.equal(exportableAssessments([a('DONE')]).length, 1);
  assert.equal(exportableAssessments([a('GRADED')]).length, 1);
  assert.match(NO_RESULT, /corrigida/);
});

test('o nome do ficheiro diz disciplina, turma, trimestre e ano, sem acentos', () => {
  assert.equal(slug('Educação Física  & Saúde'), 'educacao-fisica-saude');
  assert.equal(exportFileName(sheet), 'pauta-redes-de-computadores-12b-1t-2025-2026.pdf');
  assert.equal(exportFileName(sheet, { title: 'P1' }), 'resultado-p1-redes-de-computadores-12b-1t-2025-2026.pdf');
  assert.equal(exportFileName({ ...sheet, className: '12B' }), 'pauta-redes-de-computadores-12b-1t-2025-2026.pdf', 'a classe não se repete');
});

test('a pauta ainda não homologada leva «provisoria» no nome', () => {
  assert.equal(exportFileName({ ...sheet, status: 'REGISTADA' }), 'pauta-redes-de-computadores-12b-1t-2025-2026-provisoria.pdf');
});

test('o nome volta do Content-Disposition, em UTF-8 ou simples', () => {
  const name = 'pauta-redes-12b-1t-2025-2026.pdf';
  assert.equal(fileNameFrom(attachmentHeader(name), 'x.pdf'), name);
  assert.equal(fileNameFrom('attachment; filename="a.pdf"', 'x.pdf'), 'a.pdf');
  assert.equal(fileNameFrom(null, 'x.pdf'), 'x.pdf');
  assert.equal(fileNameFrom("attachment; filename*=UTF-8''%E0%A4%A", 'x.pdf'), 'x.pdf', 'codificação partida cai no de reserva');
});

test('cada recusa do backend tem uma frase clara, sem o texto do motor', () => {
  assert.match(exportErrorMessage(401), /Sessão expirada/);
  assert.match(exportErrorMessage(403), /Sem permissão/);
  assert.match(exportErrorMessage(404), /não encontrada/);
  assert.equal(exportErrorMessage(409, '{"detail":"This plan has no pauta at the motor yet."}'), NO_PDF_YET);
  assert.equal(exportErrorMessage(409, '{"detail":"The motor has no PDF for this report yet."}'), NO_PDF_YET);
  assert.equal(exportErrorMessage(409, '{"detail":"This assessment has no statement yet, so there is no result to export."}'), NO_STATEMENT);
  assert.match(exportErrorMessage(502, 'The motor returned a report link outside its own address.'), /ligação inválida/);
  assert.match(exportErrorMessage(503, 'The motor is unreachable.'), /indisponível/);
  const other = exportErrorMessage(500, 'stack trace at http://motor.internal:9000');
  assert.doesNotMatch(other, /motor\.internal/);
  assert.match(other, /erro 500/);
});
