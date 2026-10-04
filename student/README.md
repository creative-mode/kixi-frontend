# Kixi · App do aluno

Next.js 16 (App Router) + React 19 + TypeScript. Interface mobile-first do aluno, com o design system **Kixi v6 "Ecrã portátil, a cores"** (Press Start 2P + Plus Jakarta Sans, tokens em CSS variables, temas `light` "Ecrã" e `dark` "Noite").

```bash
cd student
npm install
npm run dev      # http://localhost:3003
npm run build
```

## Rotas

| Rota | Ecrã |
| --- | --- |
| `/entrar` | Login mínimo (logo, processo, palavra-passe) |
| `/inicio` | Feed académico: destaques da turma, continuar prova, publicar, publicações com reações |
| `/provas` | Lista com pesquisa e filtro por disciplina |
| `/prova/[id]` | Sala de prova (tema noite): cronómetro, mapa de questões, respostas |
| `/resultado` | Nota, recompensas, domínio por tema, partilha na turma |
| `/tutor` | Chat com o tutor, com a fonte de cada resposta |
| `/ranking` | Ranking relativo por turma, escola ou amigos |
| `/perfil` | HUD de nível/XP, medalhas e definições (Ecrã Noite, +25% tempo, reduzir movimento) |

## Estrutura

- `styles/tokens.css` e `lib/tokens.json`: tokens do design system (cores, espaçamento, tipografia).
- `styles/kixi.css`: CSS dos componentes do design system.
- `components/kixi.tsx`: componentes portados do bundle do design system (Logo, Icon, Button, Field, Badge, Card, ProgressBar, HudBar, Medal, AnswerOption, QuestionMap, Timer, ExamCard, Leaderboard, ChatBubble, Reward, Avatar, Story, Reactions, Post, GradeTile, Composer…). As props ainda não têm tipos (`@ts-nocheck`), para manter o ficheiro comparável com o bundle.
- `lib/data.ts`: dados de exemplo. Ainda não há ligação à API (Spring Boot) nem autenticação.
- `components/AppNav.tsx`: navegação inferior com `next/link`.

## Princípios do produto (do design system)

Sem culpa por sequências perdidas, rankings relativos em turmas pequenas sem mostrar os últimos lugares, reações só positivas, tempo ajustável nas provas e animações apenas sem `prefers-reduced-motion`.

## Notas

Este projeto vive numa subpasta do repo e é independente do app admin da raiz: tem o seu `package.json`, `next.config.ts` (com `turbopack.root`) e `postcss.config.mjs`. A raiz exclui `student/` do `tsconfig` e do ESLint.
