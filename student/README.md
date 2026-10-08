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
| `/onboarding` | Escolha de escola, curso e turma, para a conta que ainda não está matriculada |
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
- `lib/mock/backend.ts`: com `KIXI_MOCK` ligado (por omissão) responde em processo a `/me`, `/enrollments`, `/institutions`, `/courses`, `/classes` e ao resto, com as mesmas regras do backend, incluindo os filtros por escola. É o que permite desenhar sem base de dados. `KIXI_MOCK_FAULT=500` ou `=timeout` injecta uma falha de propósito, para o estado `unknown` de `lib/me.ts` deixar de ser código morto: sem isso, uma regressão que mandasse o aluno para o login quando o servidor cai passava todos os testes.

Um aluno sem matrícula é levado para `/onboarding` e escolhe escola, curso e turma, com a lista a estreitar a cada passo (`/courses?institutionId=`, `/classes?institutionId=&courseId=`) e só com turmas do ano letivo corrente.

A escola da turma é a do curso, nunca escolhida à parte: `Class` não tem escola própria, e a base de dados garante a igualdade com uma chave estrangeira composta. O `/me` responde com a escola da turma quando há matrícula, e com a escola da ligação administrativa quando não há — por isso um aluno que se matriculou sozinho vê a escola preenchida (creative-mode/kixi#100).


## basePath

A app é servida em `/aluno`, e o Next não aplica esse prefixo de forma uniforme. Duas regras
que já custaram um 404:

- **`redirect()` numa server action quer o caminho cru.** O Next escreve o valor no cabeçalho
  `x-action-redirect` e é o cliente que lhe acrescenta o basePath. `redirect('/inicio')` chega
  a `/aluno/inicio`; `redirect('/aluno/inicio')` chega a `/aluno/aluno/inicio`, que não existe.
  Vale para `lib/auth-actions.ts` e `lib/enrollment-actions.ts`.
- **`redirect()` num Server Component quer o caminho com o prefixo.** Aí o Next aplica-o
  durante o render. Vale para `lib/guard.ts` e para as páginas.

`<Link>`, `router.push()` e `<form>` sem `action` tratam do prefixo sozinhos. Um `action`
escrito à mão num `<form>` não trata, que é porque os dois passos GET do onboarding não o
têm: sem `action` o formulário submete para o URL actual, que já traz `/aluno`.

Consequência aceite: sem JavaScript, o `Location` da server action vem sem o prefixo e o login
termina em 404. Os formulários de sessão são submitidos por JavaScript de qualquer maneira
(`useActionState`), e corrigir isto exigiria um URL absoluto montado a partir de um cabeçalho
do pedido, que é uma superfície de open redirect que não vale um 404 sem JavaScript.

