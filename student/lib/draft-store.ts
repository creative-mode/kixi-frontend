/** Rascunho local das respostas ainda por confirmar (#587), puro para o `node --test` o alcançar.
 *
 *  A fila de gravação (save-queue.ts) só vive em memória: se o aluno fechar o separador, o telemóvel ficar sem rede ou o browser
 *  reiniciar com respostas que o servidor ainda não confirmou, perdem-se. Aqui guarda-se, por simulação, só o que ainda não está
 *  confirmado: se uma entrada existe, é mais recente do que a do servidor, e some quando o servidor a confirma.
 *
 *  Fica no browser do aluno, por isso tem validade curta e limpa-se quando a prova fecha. Em computadores partilhados da escola o próprio
 *  aluno é o único a abrir a sua simulação (a chave é o id dela), e nada daqui sai para o servidor sem passar pela fila normal. */

export interface Resposta {
  optionId: number | null;
  text: string;
}

export interface Armazem {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

const VERSAO = 1;
/** Mais do que uma prova dura, menos do que o tempo de alguém a abrir outra sessão no mesmo computador. */
export const VALIDADE_MS = 24 * 60 * 60 * 1000;
/** Um texto maior do que isto não é uma resposta: é lixo, e não se guarda nem se restaura. */
const MAX_TEXTO = 20_000;

export const chaveRascunho = (simulationId: number): string => `kixi:rascunho:${simulationId}`;

function valida(valor: unknown): valor is Resposta {
  if (typeof valor !== 'object' || valor === null) return false;
  const r = valor as Record<string, unknown>;
  const opcao = r.optionId;
  return (opcao === null || (typeof opcao === 'number' && Number.isInteger(opcao))) && typeof r.text === 'string' && r.text.length <= MAX_TEXTO;
}

/** Guarda as respostas por confirmar; sem nenhuma, apaga a entrada. Um armazém cheio ou indisponível (modo privado) não pode estragar a prova. */
export function guardarRascunho(armazem: Armazem, simulationId: number, respostas: Record<number, Resposta>, agora: number = Date.now()): void {
  try {
    const ids = Object.keys(respostas);
    if (ids.length === 0) {
      armazem.removeItem(chaveRascunho(simulationId));
      return;
    }
    armazem.setItem(chaveRascunho(simulationId), JSON.stringify({ v: VERSAO, em: agora, respostas }));
  } catch {
    // sem rascunho local a fila continua a funcionar como antes
  }
}

/** O rascunho desta simulação; vazio se não existe, expirou ou está estragado (e nesse caso apaga-o). */
export function lerRascunho(armazem: Armazem, simulationId: number, agora: number = Date.now()): Record<number, Resposta> {
  const chave = chaveRascunho(simulationId);
  try {
    const bruto = armazem.getItem(chave);
    if (!bruto) return {};
    const dados = JSON.parse(bruto) as { v?: unknown; em?: unknown; respostas?: unknown };
    if (dados.v !== VERSAO || typeof dados.em !== 'number' || agora - dados.em > VALIDADE_MS || typeof dados.respostas !== 'object' || dados.respostas === null) {
      armazem.removeItem(chave);
      return {};
    }
    const saida: Record<number, Resposta> = {};
    for (const [id, valor] of Object.entries(dados.respostas as Record<string, unknown>)) {
      const questao = Number(id);
      if (Number.isInteger(questao) && questao > 0 && valida(valor)) saida[questao] = { optionId: valor.optionId, text: valor.text };
    }
    return saida;
  } catch {
    try {
      armazem.removeItem(chave);
    } catch {
      // nada a fazer
    }
    return {};
  }
}

export function limparRascunho(armazem: Armazem, simulationId: number): void {
  try {
    armazem.removeItem(chaveRascunho(simulationId));
  } catch {
    // nada a fazer
  }
}

const vazia = (r: Resposta): boolean => r.optionId === null && r.text.trim().length === 0;
const igual = (a: Resposta, b: Resposta): boolean => a.optionId === b.optionId && a.text.trim() === b.text.trim();

/** O que há a restaurar: respostas do rascunho a questões que ainda existem na prova, que não estão vazias e que diferem do que o servidor tem. */
export function aRecuperar(
  rascunho: Record<number, Resposta>,
  questoes: readonly number[],
  guardadoNoServidor: Record<number, Resposta | undefined>,
): Record<number, Resposta> {
  const existentes = new Set(questoes);
  const saida: Record<number, Resposta> = {};
  for (const [id, resposta] of Object.entries(rascunho)) {
    const questao = Number(id);
    if (!existentes.has(questao) || vazia(resposta)) continue;
    const noServidor = guardadoNoServidor[questao];
    if (noServidor && igual(noServidor, resposta)) continue;
    saida[questao] = resposta;
  }
  return saida;
}
