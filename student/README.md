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
| `/inicio` | Feed da turma: simulação em curso, publicar, publicações com Útil, comentários e guardar; painel com temas a rever, turma e próximas provas |
| `/provas` | Lista de provas com pesquisa, filtro por disciplina, estado e carregar prova |
| `/prova/[id]` | Sala de prova: cronómetro, questão, navegação por questões, marcar para rever |
| `/resultado` | Nota, respostas certas, domínio por tema e questões a rever |
| `/ranking` | A turma: média por aluno (turma, escola ou amigos) |
| `/tutor` | Conversa com o tutor, com a fonte de cada resposta |
| `/perfil` | Perfil, atividade, desempenho, guardados e definições (tema escuro, +25% de tempo) |

## Estrutura

- `styles/theme.css`: tokens (cores claro/escuro, raios, tipo) e fonte Plus Jakarta Sans.
- Estilo: Tailwind v4 + componentes shadcn (`components/ui`) sobre os tokens do design system partilhado (`design-system/README.md`; `npm run ds:sync` na raiz). Em ecrãs largos há barra lateral e painel à direita; no telemóvel, barra superior e separadores em baixo.
- `components/brand.tsx`, `icon.tsx`, `user-avatar.tsx`, `mastery.tsx`: marca, ícones, avatar e barra de domínio. `components/Shell.tsx`: navegação. `components/AuthShell.tsx`: ecrã de entrada/cadastro.
- `lib/data.ts`: dados de exemplo. Ainda não há ligação à API para o conteúdo; o login e o cadastro usam o backend.
