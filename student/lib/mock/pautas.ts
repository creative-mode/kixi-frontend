import type { MyTermSheet } from '../pautas-rules';

/**
 * As pautas do aluno no mock (kixi#506): só a linha dele, só pautas fechadas, só da sua turma. Puro: recebe o que precisa
 * por parâmetro, para se testar sem arrancar o mock. Os valores variam com a conta, para dois alunos não verem o mesmo.
 */
export function ownTermSheets(input: { accountId: number; className: string; schoolYear: string; subjects: { code: string; name: string }[] }): MyTermSheet[] {
  const out: MyTermSheet[] = [];
  for (const term of [1, 2]) {
    input.subjects.slice(0, 3).forEach((subject, i) => {
      // Determinístico: varia com a conta, o trimestre e a disciplina; o 3.º trimestre ainda não está fechado e não entra.
      const seed = input.accountId * 7 + term * 3 + i * 5;
      const mac = 10 + (seed % 9);
      const p1 = 9 + ((seed * 3) % 10);
      const p2 = 8 + ((seed * 5) % 11);
      const mt = Math.floor((mac + p1 + p2) / 3 + 0.5);
      out.push({
        sheetId: `PT-MOCK-${term}-${subject.code}`, termNumber: term, schoolYear: input.schoolYear, subjectName: subject.name, subjectCode: subject.code, className: input.className,
        row: { mac, p1, p2, mt, status: mt >= 10 ? 'POSITIVA' : 'NEGATIVA' },
      });
    });
  }
  return out;
}
