/** O que falta para a prova se poder guardar e publicar, em texto: testável com `node --test`. */

export interface ReadinessInput {
  hasSchool: boolean;
  hasSubject: boolean;
  /** Só o gestor pode guardar sem turma; o professor precisa de a escolher. */
  hasClass: boolean;
  hasQuestion: boolean;
}

/** O que impede de guardar, na ordem em que o formulário se preenche. */
export function missingToSave(input: ReadinessInput): string[] {
  const missing: string[] = [];
  if (!input.hasSchool) missing.push('escola');
  if (!input.hasSubject) missing.push('disciplina');
  if (!input.hasClass) missing.push('turma');
  if (!input.hasQuestion) missing.push('pelo menos uma questão');
  return missing;
}

/**
 * As frases que se mostram junto aos botões. Vazia quando a prova está pronta: o aviso
 * não fica a ocupar espaço depois de deixar de ser verdade.
 */
export function readinessSummary(missing: string[], problemCount: number): string[] {
  const lines: string[] = [];
  if (missing.length > 0) lines.push(`Para guardar faltam: ${missing.join(', ')}.`);
  if (problemCount > 0) lines.push(`Para publicar, corrija ${problemCount} ${problemCount === 1 ? 'ponto' : 'pontos'} nas questões.`);
  return lines;
}
