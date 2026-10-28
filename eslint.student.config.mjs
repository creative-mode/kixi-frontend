import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// O aluno não tem o seu ESLint: usa os plugins da raiz com as mesmas regras do gestor (eslint.config.mjs), a partir de `npm run lint`.
export default defineConfig([
  { linterOptions: { reportUnusedDisableDirectives: 'off' } },
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  reactHooks.configs.flat['recommended-latest'],
  {
    settings: { react: { version: 'detect' } },
    rules: {
      // O prefixo `_` marca o que se ignora de propósito (parâmetros, desestruturação para descartar).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', ignoreRestSiblings: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },
  // As regras novas do React Compiler (react-hooks 7) apanham padrões antigos do aluno (contador, barra de progresso, espelho de estado em ref,
  // Date.now() no render). Reescrevê-los às cegas muda comportamento: ficam em aviso, para corrigir um a um com o seu teste. Não bloqueiam a CI.
  {
    rules: {
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  // Alguns <img> trazem `eslint-disable @next/next/no-img-element`: o aluno não corre o plugin do Next, mas o comentário tem de resolver.
  { plugins: { '@next/next': { rules: { 'no-img-element': { meta: { schema: [] }, create: () => ({}) } } } } },
  globalIgnores(["student/.next/**", "student/node_modules/**", "student/next-env.d.ts", "student/out/**"]),
]);
