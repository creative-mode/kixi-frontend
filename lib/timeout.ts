/**
 * Um pedido que a página espera tem sempre um fim. Se o servidor não responde,
 * o ecrã mostra erro e "Tentar novamente" — nunca um esqueleto para sempre (#191).
 *
 * O `signal` aborta o `fetch` a sério; o `withDeadline` é a rede de segurança
 * para os transportes que ignoram o sinal (o mock em processo, por exemplo, não
 * olha para ele) e para os que não aceitam um. Juntos, garantem que nenhum
 * pedido fica pendente indefinidamente.
 */

/** Prazo por omissão de um pedido de leitura. Curto de mais corta o backend
 *  lento; longo de mais deixa o esqueleto. 15 s é o pior caso que já vimos. */
export const REQUEST_TIMEOUT_MS = 15_000;

export const TIMEOUT_MESSAGE = 'O servidor demorou a responder. Tente novamente.';

/** Prazo no cliente para uma chamada a server action. O servidor já tem o seu
 *  (15 s); este é a rede de segurança para quando a chamada nem chega a
 *  responder — o action do Next retenta sozinho e, sem isto, o componente
 *  ficava no esqueleto para sempre (#191). */
export const ACTION_TIMEOUT_MS = 12_000;

export function timeoutSignal(ms: number = REQUEST_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms);
}

export function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'TimeoutError';
}

/** O trabalho tem de terminar antes do prazo; passado ele, rejeita com um
 *  `TimeoutError` legível em vez de esperar para sempre. */
export async function withDeadline<T>(work: Promise<T>, ms: number = REQUEST_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DOMException(TIMEOUT_MESSAGE, 'TimeoutError')), ms);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
