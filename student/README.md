# Kixi · App do aluno

Next.js 16 (App Router) + React 19 + TypeScript. Interface mobile-first do aluno, com o design system **Kixi v6 "Ecrã portátil, a cores"** (Press Start 2P + Plus Jakarta Sans, tokens em CSS variables, temas `light` "Ecrã" e `dark` "Noite").

```bash
cd student
npm install
npm run dev      # http://localhost:3003/aluno (ou, com tudo junto: npm run dev:all na raiz → http://localhost:3000/aluno)
npm run build
```

## Rotas

| Rota | Ecrã |
| --- | --- |
| `/entrar`, `/cadastro` | Entrar e criar conta, com painel de apresentação em ecrãs largos |
| `/onboarding` | Escolha de curso e turma, para a conta que ainda não está matriculada |
| `/inicio` | Feed da turma: simulação em curso, publicar, publicações com Útil, comentários e guardar; painel com temas a rever, turma e próximas provas |
| `/provas` | Lista de provas com pesquisa, filtro por disciplina, estado e carregar prova |
| `/prova/[id]` | Sala de prova: cronómetro, questão, navegação por questões, marcar para rever |
| `/resultado` | Nota, respostas certas, domínio por tema e questões a rever |
| `/ranking` | A turma: média por aluno (turma, escola ou amigos) |
| `/tutor` | Conversa com o tutor, com a fonte de cada resposta |
| `/perfil` | Perfil com os dados reais da conta, atividade, desempenho, guardados, edição de nome e foto, e definições (tema escuro, +25% de tempo) |

## Estrutura

- `styles/theme.css`: tokens (cores claro/escuro, raios, tipo) e fonte Plus Jakarta Sans.
- Estilo: Tailwind v4 + componentes shadcn (`components/ui`) sobre os tokens do design system partilhado (`design-system/README.md`; `npm run ds:sync` na raiz). Em ecrãs largos há barra lateral e painel à direita; no telemóvel, barra superior e separadores em baixo.
- `components/brand.tsx`, `icon.tsx`, `user-avatar.tsx`, `mastery.tsx`: marca, ícones, avatar e barra de domínio. `components/Shell.tsx`: navegação. `components/AuthShell.tsx`: ecrã de entrada/cadastro.
- `lib/data.ts`: dados de exemplo do **conteúdo** (feed, provas, ranking, tutor). O perfil do aluno já não vem daqui.

## Dados do aluno

O perfil, a matrícula e a edição de nome e foto falam com o backend:

- `lib/api.ts`: cliente único. Carrega o token do cookie `auth_token`, trata Problem Details (RFC 9457) e distingue o 401 sem corpo que a camada de segurança devolve.
- `lib/types.ts`: os DTOs do backend. `MeResponse` mistura `snake_case` (`first_name`, `school_year_id`) com `camelCase` — é assim que vem, não corrigir.
- `lib/me.ts`: `GET /me`, uma vez por request. Devolve três estados, e a distinção importa: `unauthorized` (401) leva ao login, `unknown` (rede caída, 500) deixa o aluno passar e `ok` é a única resposta que pode mandar para o onboarding. Tratar tudo como "sem perfil" trancava o aluno fora do feed quando o servidor tinha um problema.
- `lib/guard.ts`: sessão viva e papel de aluno. Partilhado entre o shell e o onboarding.
- `lib/me-context.tsx`: publica o perfil aos ecrãs cliente, para haver uma só fonte de verdade do nome e da turma.
- `lib/mock/backend.ts`: com `KIXI_MOCK` ligado (por omissão) responde em processo a `/me`, `/enrollments`, `/courses`, `/classes` e ao resto, com as mesmas regras do backend. É o que permite desenhar sem base de dados.

Um aluno sem matrícula é levado para `/onboarding` e escolhe curso e turma. Não escolhe escola: `Class` não tem `institutionId` e a ligação aluno↔escola é ADMIN-only, por isso a API ainda não deixa o aluno gravá-la (creative-mode/kixi#100, reaberta).

