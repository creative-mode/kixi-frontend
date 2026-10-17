/** Frases em português para os estados HTTP que o backend devolve.
 *  O texto do servidor (`detail`) está em inglês e é técnico: serve para registos, não para o aluno. */
export function messageForStatus(status: number): string {
  if (status === 401) return 'A sessão expirou. Entra novamente.';
  if (status === 403) return 'Não tens permissão para fazer isto.';
  if (status === 404) return 'Não encontrámos o que procuravas. Pode já não estar disponível.';
  if (status === 408) return 'O servidor demorou a responder. Tenta de novo.';
  if (status === 409) return 'Isto já existe ou foi alterado entretanto. Atualiza a página e tenta de novo.';
  if (status === 400 || status === 422) return 'Há dados que não estão certos. Verifica e tenta de novo.';
  if (status === 413) return 'O ficheiro é grande demais.';
  if (status === 429) return 'Foram feitos pedidos a mais. Espera um momento e tenta de novo.';
  if (status >= 500) return 'O servidor teve um problema. Tenta de novo daqui a pouco.';
  return 'Não foi possível concluir. Tenta de novo.';
}

/** Só faz sentido tentar de novo quando a falha pode passar sozinha. */
export function isRetryable(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}
