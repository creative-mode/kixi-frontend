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
- `NEXT_PUBLIC_SITE_URL` — endereço público da landing (por omissão `https://kixi.creativemode.ao`, o de produção). Entra no build: no Docker é `--build-arg`, no compose vem do `.env` e na publicação da variável do repositório com o mesmo nome. Usado no canonical, no Open Graph, no `robots.txt` e no `sitemap.xml`.
- `NEXT_PUBLIC_CONTACT_EMAIL` — opcional. Quando definido, o rodapé mostra o contacto; sem ele, não aparece nenhum endereço.
- `NEXT_PUBLIC_APP_URL` — endereço do app do aluno. opcional. Por omissão o app do aluno está no mesmo endereço, em `/aluno`: "Entrar" abre `/aluno/entrar` e "Começar a estudar" abre `/aluno/cadastro`. Só é preciso se o app do aluno estiver noutro domínio.

## Estrutura
- `lib/content.ts` — todo o texto (módulos I–V, públicos, FAQ por público). Editar aqui.
- `app/opengraph-image.tsx`, `app/robots.ts`, `app/sitemap.ts` — SEO; as fontes da imagem de partilha estão em `assets/og/` (TTF, porque o gerador não lê woff2).
- `components/sections/*` — uma secção por ficheiro.
- `components/kixi.tsx`, `styles/*` — componentes e tokens do design system.
- `app/globals.css` — estilos da página; animações só com `prefers-reduced-motion: no-preference`.

A landing não mostra maquetas com dados: só ilustrações (consola, cartucho). Não há métricas, alunos nem notas inventadas.
