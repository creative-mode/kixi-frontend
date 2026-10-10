// Pendências do gabarito: as mesmas duas regras que o `POST /statements/{id}/approve`
// aplica no servidor (StatementService.answerKeyComplete e requireTheScoresToAddUp).
// O servidor é quem manda; isto existe para o professor ver o que falta antes do 422.
//
// A regra das opções olha para as opções e não para o `questionType`: é o que o
// servidor faz, porque o tipo tem várias grafias em circulação e uma questão escrita
// antes das alternativas não diz o que vai ser. A resposta modelo não entra: o
// servidor não a pede para aprovar.

export type AnswerKeyQuestion = { number: number; maxScore: number; options: { isCorrect: boolean }[] };

/** Em cêntimos: cada cotação é guardada em DECIMAL(10, 2), por isso arredonda antes de somar. */
const cents = (n: number) => (Number.isFinite(n) ? Math.round(n * 100) : 0);

export function answerKeyIssues(questions: AnswerKeyQuestion[], totalMaxScore: number | null): string[] {
  const out: string[] = [];
  for (const q of questions) {
    if (q.options.length > 0 && !q.options.some((o) => o.isCorrect)) out.push(`Questão ${q.number} tem opções mas nenhuma marcada como correta`);
  }
  // Sem total declarado o servidor não compara, e aqui também não.
  if (totalMaxScore != null) {
    const sum = questions.reduce((a, q) => a + cents(q.maxScore), 0);
    if (sum !== cents(totalMaxScore)) {
      const fmt = (c: number) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(c / 100);
      out.push(`As cotações somam ${fmt(sum)}, mas a prova vale ${fmt(cents(totalMaxScore))}`);
    }
  }
  return out;
}
