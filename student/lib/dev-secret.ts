export type BackendMode = 'mock' | 'real';

type RuntimeEnvironment = Record<string, string | undefined>;

const DEMO_JWT_SECRET = 'default-secret-change-in-production-min-256-bits';

export function isMockEnabled(env: RuntimeEnvironment = process.env): boolean {
  return env.KIXI_MOCK === 'true';
}

export function validateRuntimeConfiguration(
  env: RuntimeEnvironment = process.env,
): BackendMode {
  if (env.KIXI_MOCK !== 'true' && env.KIXI_MOCK !== 'false') {
    throw new Error('KIXI_MOCK tem de ser definido explicitamente como true ou false');
  }

  if (isMockEnabled(env)) {
    if (env.NODE_ENV === 'production' && env.KIXI_ALLOW_MOCK_IN_PROD !== 'true') {
      throw new Error('KIXI_MOCK em produção exige KIXI_ALLOW_MOCK_IN_PROD=true');
    }
    return 'mock';
  }

  if (!env.BACKEND_API_URL?.trim()) {
    throw new Error('BACKEND_API_URL é obrigatório quando KIXI_MOCK=false');
  }
  if (!env.JWT_SECRET?.trim()) {
    throw new Error('JWT_SECRET é obrigatório quando KIXI_MOCK=false');
  }

  return 'real';
}

export function getJwtSecretValue(env: RuntimeEnvironment = process.env): string {
  const configured = env.JWT_SECRET?.trim();
  if (configured) return configured;
  if (isMockEnabled(env)) return DEMO_JWT_SECRET;
  throw new Error('JWT_SECRET é obrigatório fora do modo de demonstração');
}
