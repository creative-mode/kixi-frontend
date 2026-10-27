// Token do gestor para o Camunda por client credentials (OIDC). Sem dependências do Next, para se testar à parte.

export type ConfiguracaoToken = { url: string; clientId: string; clientSecret: string; audiencia?: string };

type Resposta = { access_token?: string; expires_in?: number };

const MARGEM_MS = 30_000;

export class FonteDeToken {
  private guardado: { valor: string; expiraEm: number } | null = null;
  private emCurso: Promise<string> | null = null;
  private readonly cfg: ConfiguracaoToken;
  private readonly pedir: typeof fetch;
  private readonly agora: () => number;

  constructor(cfg: ConfiguracaoToken, pedir: typeof fetch = fetch, agora: () => number = Date.now) {
    this.cfg = cfg;
    this.pedir = pedir;
    this.agora = agora;
  }

  /** O token em cache enquanto faltar mais do que a margem para expirar; pedidos em simultâneo partilham o mesmo pedido. */
  async obter(): Promise<string> {
    if (this.guardado && this.guardado.expiraEm - MARGEM_MS > this.agora()) return this.guardado.valor;
    this.emCurso ??= this.renovar().finally(() => {
      this.emCurso = null;
    });
    return this.emCurso;
  }

  /** Esquece o token (por exemplo depois de um 401). */
  invalidar(): void {
    this.guardado = null;
  }

  private async renovar(): Promise<string> {
    const corpo = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.cfg.clientId,
      client_secret: this.cfg.clientSecret,
    });
    if (this.cfg.audiencia) corpo.set('audience', this.cfg.audiencia);
    const res = await this.pedir(this.cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: corpo,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    // O corpo de um erro pode repetir o pedido: só o estado vai para a mensagem.
    if (!res.ok) throw new Error(`O fornecedor de identidade recusou o token (${res.status}).`);
    const r = (await res.json()) as Resposta;
    if (!r.access_token) throw new Error('O fornecedor de identidade não devolveu access_token.');
    this.guardado = { valor: r.access_token, expiraEm: this.agora() + (r.expires_in ?? 60) * 1000 };
    return r.access_token;
  }
}

/** Lê a configuração do ambiente; sem as três variáveis não há client credentials. */
export function configuracaoDoAmbiente(env: Record<string, string | undefined>): ConfiguracaoToken | null {
  const url = env.SCHOOLOPS_CAMUNDA_TOKEN_URL;
  const clientId = env.SCHOOLOPS_CAMUNDA_CLIENT_ID;
  const clientSecret = env.SCHOOLOPS_CAMUNDA_CLIENT_SECRET;
  if (!url || !clientId || !clientSecret) return null;
  return { url, clientId, clientSecret, audiencia: env.SCHOOLOPS_CAMUNDA_AUDIENCE || undefined };
}
