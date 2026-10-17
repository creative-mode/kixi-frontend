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
- `NEXT_PUBLIC_CONTACT_EMAIL` — opcional. Quando definido, o rodapé mostra o contacto; sem ele, não aparece nenhum endereço. Entra também no `Organization` do JSON-LD.
- `NEXT_PUBLIC_CONTACT_PHONE` — opcional. Telefone no `ContactPoint` do JSON-LD.
- `NEXT_PUBLIC_CONTACT_STREET`, `NEXT_PUBLIC_CONTACT_LOCALITY`, `NEXT_PUBLIC_CONTACT_POSTAL_CODE`, `NEXT_PUBLIC_CONTACT_COUNTRY` — opcionais. Rua e localidade juntas formam o `PostalAddress`; sem as duas, o JSON-LD vai sem morada. São dados de uma entidade real: quem os escrever é que os declara.
- `NEXT_PUBLIC_APP_URL` — endereço do app do aluno. opcional. Por omissão o app do aluno está no mesmo endereço, em `/aluno`: "Entrar" abre `/aluno/entrar` e "Começar a estudar" abre `/aluno/cadastro`. Só é preciso se o app do aluno estiver noutro domínio.

## Estrutura
- `lib/content.ts` — todo o texto (módulos I–V, públicos, FAQ por público). Editar aqui.
- `app/[path]/page.tsx`, `lib/trust-pages.ts` — `/about`, `/contact` e `/privacy`. O texto vive em Markdown e é renderizado para HTML e para a rota de Markdown, para as duas versões não divergirem.
- `proxy.ts`, `app/api/markdown`, `app/llms.txt`, `lib/markdown.ts` — negociação de conteúdo: `Accept: text/markdown` recebe Markdown, e um caminho que não existe recebe 404 em Markdown em vez de HTML.
- `lib/structured-data.ts`, `components/JsonLd.tsx` — JSON-LD, gerado do `content.ts`.
- `app/opengraph-image.tsx`, `app/robots.ts`, `app/sitemap.ts` — SEO; as fontes da imagem de partilha estão em `assets/og/` (TTF, porque o gerador não lê woff2).
- `components/sections/*` — uma secção por ficheiro.
- `components/kixi.tsx`, `styles/*` — componentes e tokens do design system.
- `app/globals.css` — estilos da página; animações só com `prefers-reduced-motion: no-preference`.

A landing não mostra maquetas com dados: só ilustrações (consola, cartucho). Não há métricas, alunos nem notas inventadas.
