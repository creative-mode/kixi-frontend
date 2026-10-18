/**
 * Validação do código de matrícula (kixi#255): a auto-matrícula (a conta a matricular-se a
 * si própria, sem ser ADMIN/TEACHER) passa a exigir um código válido, ao contrário da
 * matrícula feita por um admin ou professor em nome de outra conta.
 *
 * Vive no seu próprio módulo pela mesma razão que `school.ts`: `mock/backend.ts` começa com
 * `import 'server-only'`, que um `node --test` simples não resolve — e uma regra que não se
 * consegue testar é uma regra que já esteve ao contrário sem ninguém notar.
 */

export type EnrollmentCode = {
  id: number;
  code: string;
  maxUses: number;
  uses: number;
  expiresAt: string | null;
  revokedAt: string | null;
};

export type ValidacaoCodigo =
  | { ok: true; entry: EnrollmentCode }
  | { ok: false; status: number; detail: string };

/** `agora` é um parâmetro, não `new Date()`, para o teste de expiração não depender do relógio. */
export function validarCodigoDeMatricula(
  codes: EnrollmentCode[],
  code: string,
  agora: Date,
): ValidacaoCodigo {
  const entry = codes.find((c) => c.code === code);
  if (!entry) return { ok: false, status: 400, detail: 'Invalid enrollment code' };
  if (entry.revokedAt) return { ok: false, status: 400, detail: 'Enrollment code has been revoked' };
  if (entry.expiresAt && new Date(entry.expiresAt) <= agora) {
    return { ok: false, status: 400, detail: 'Enrollment code has expired' };
  }
  if (entry.uses >= entry.maxUses) return { ok: false, status: 400, detail: 'Enrollment code has no uses left' };
  return { ok: true, entry };
}
