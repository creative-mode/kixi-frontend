// A falha injetada no mock (`KIXI_MOCK_FAULT`), em runtime ou pelo ambiente.

export type Fault = '' | '500' | 'timeout';

/** Só `500` e `timeout` são falhas; qualquer outra coisa desliga-a. */
export function normalizeFault(mode: unknown): Fault {
  const value = typeof mode === 'string' ? mode.trim().toLowerCase() : '';
  return value === '500' || value === 'timeout' ? value : '';
}

/** O que foi ligado em runtime ganha ao ambiente, mesmo desligado (`''`): é assim que o e2e repõe o normal. */
export function effectiveFault(runtime: Fault | undefined, env: unknown): Fault {
  return runtime !== undefined ? runtime : normalizeFault(env);
}
