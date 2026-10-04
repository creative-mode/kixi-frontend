# Kixi · Landing page

Página de produto do Kixi (Next.js 16, App Router), construída com o design system v6 ("Ecrã portátil, a cores").
Conteúdo baseado no documento de conceito do Kixi.

## Correr
```bash
cd landing
npm install
npm run dev      # http://localhost:3004
npm run build && npm start
npm run lint     # tsc --noEmit
```

## Configuração
- `NEXT_PUBLIC_APP_URL` — endereço do app do aluno. "Entrar" abre `<url>/entrar` e "Começar a estudar" abre `<url>/cadastro` (por omissão `http://localhost:3003`).

## Estrutura
- `lib/content.ts` — todo o texto (módulos, públicos, FAQ). Editar aqui.
- `components/sections/*` — uma secção por ficheiro.
- `components/kixi.tsx`, `styles/*` — componentes e tokens do design system.
- `app/globals.css` — estilos da página; animações só com `prefers-reduced-motion: no-preference`.

As maquetas da secção "App do aluno" usam dados de exemplo. Não há métricas inventadas.
