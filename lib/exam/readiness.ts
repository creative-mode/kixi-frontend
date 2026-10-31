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

/** As frases que se mostram junto aos botões, separadas: «Guardar» só se explica pelo que falta, «Publicar» também pelos problemas. */
export function readinessParts(missing: string[], problemCount: number): { toSave: string | null; toPublish: string | null } {
  return {
    toSave: missing.length > 0 ? `Para guardar faltam: ${missing.join(', ')}.` : null,
    toPublish: problemCount > 0 ? `Para publicar, corrija ${problemCount} ${problemCount === 1 ? 'ponto' : 'pontos'} nas questões.` : null,
  };
}

/**
 * As mesmas frases em lista. Vazia quando a prova está pronta: o aviso não fica a ocupar espaço
 * depois de deixar de ser verdade.
 */
export function readinessSummary(missing: string[], problemCount: number): string[] {
  const { toSave, toPublish } = readinessParts(missing, problemCount);
  return [toSave, toPublish].filter((line): line is string => line !== null);
}

export interface SaveState {
  saving: boolean;
  /** A prova guardada é igual ao rascunho: guardar outra vez criava um duplicado. */
  unchangedSinceSave: boolean;
  /** A prova ficou criada mas a anexação ou publicação dos recortes ficou a meio. */
  pendingPublication: boolean;
}

/**
 * Porque é que «Guardar» e «Publicar» estão desativados quando não é por falta de dados: a gravar, já guardada
 * sem alterações, ou com a publicação por retomar. `null` quando nada disto os trava.
 */
export function saveBlocker(state: SaveState): string | null {
  if (state.saving) return 'A guardar a prova…';
  if (state.pendingPublication) return 'A publicação ficou a meio: retome-a no cartão da prova guardada.';
  if (state.unchangedSinceSave) return 'A prova já está guardada. Altere alguma coisa para a guardar de novo.';
  return null;
}
