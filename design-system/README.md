# Kixi Design System

Sistema de design partilhado pelas apps do Kixi (aluno e gestor). Segue o modelo do **shadcn/ui**: tokens como variáveis CSS com os nomes do shadcn, mapeadas no Tailwind v4, e componentes Radix + `cva` copiados para o projecto (`components/ui`).

## Ficheiros

| Ficheiro | Para quê |
| --- | --- |
| `tokens.css` | **Fonte única** das cores, raio e sombras. Temas claro e escuro. |
| `theme.css` | Mapeia os tokens para utilitários Tailwind v4 (`bg-primary`, `text-muted-foreground`, `bg-success-soft`…) e define a fonte. |

As cópias em `app/ds-*.css` (gestor) e `student/styles/ds-*.css` (aluno) são **geradas**. Não as edites.

```bash
npm run ds:sync            # copia tokens.css e theme.css para as duas apps
npm run ds:sync -- --check # falha se alguma cópia estiver desactualizada (CI)
```

## Tokens

- **Base shadcn:** `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `sidebar-*`, `chart-1..5` (cada um com `-foreground` onde aplicável).
- **Estado (extensão Kixi):** `success`, `warning`, `info` e os fundos suaves `success-soft`, `warning-soft`, `info-soft`, `danger-soft`.
- **Raio:** `--radius: .625rem` (`rounded-md` = raio − 2px, `rounded-xl` = raio + 4px).
- **Tema:** claro por omissão; escuro com `data-theme="dark"` (ou `.dark`) no `<html>`. A preferência vive em `localStorage['kixi-theme']`, partilhada entre as apps porque correm na mesma origem.

Regra: nunca uses cores literais em componentes. Usa sempre o token (`text-destructive`, não `text-red-600`).

## Componentes (`components/ui`)

Base comum às duas apps: `Button` (default, secondary, outline, ghost, destructive, link; tamanhos sm/default/lg/icon), `Input`, `Label`, `Card`, `Badge` (default, secondary, outline, success, warning, info, destructive), `Table`, `Checkbox`.

`Skeleton` / `SkeletonText`: marcador de carregamento (bloco `muted` com varrimento de luz; respeita `prefers-reduced-motion`). Dá-lhe a forma do conteúdo real. No gestor há composições prontas em `components/dashboard/dashboard-skeleton.tsx` (KPI, atalho, tabela, gráfico, secção e a dashboard inteira).

Só no aluno: `Textarea`, `Avatar`, `Progress`, `Separator`, `Switch`, `Tabs`, `Alert`, `Field` (rótulo + controlo + erro) e `PasswordInput`.
O gestor traz ainda o conjunto completo do shadcn (dialog, sheet, select, sidebar, etc.), já a usar os mesmos tokens.

## Usar

```tsx
<Field label="Email" error={state.errors?.email}>
  <Input name="email" type="email" autoComplete="email" />
</Field>
<Button size="lg" className="w-full">Entrar</Button>
<Badge variant="success">Publicado</Badge>
```

## Novos componentes

1. Cria o componente em `components/ui` da app (ou `npx shadcn@latest add <nome>` no gestor).
2. Usa só tokens. Precisas de uma cor nova? Acrescenta-a a `tokens.css` (claro **e** escuro) e a `theme.css`, e corre `npm run ds:sync`.
3. Verifica nos dois temas e a 390px de largura.

## Auth

Uma coluna centrada: marca e cartão com o formulário (400px), sem painel lateral. Aluno: `student/components/AuthShell.tsx`; gestor: `app/login/page.tsx`.

## Estados da dashboard

- **A carregar:** esqueletos com a forma do conteúdo, nunca spinners em branco.
- **Sem sessão (401/403):** aviso neutro com "Iniciar sessão", sem vermelho; as secções de dados escondem-se em vez de repetirem o erro.
- **Erro genérico:** aviso suave com `warning` e "Tentar novamente". O vermelho (`destructive`) fica para acções destrutivas e valores baixos.

## Loading (skeletons)

- **App do aluno**: cada rota tem um `loading.tsx` que usa `components/skeletons.tsx` (`InicioSkeleton`, `ProvasSkeleton`, `RankingSkeleton`, `TutorSkeleton`, `PerfilSkeleton`, `ResultadoSkeleton`, `ProvaSkeleton`, `AuthSkeleton`). Reaproveitam `Page`/`Column`/`Rail`, por isso têm a mesma largura e grelha da página real e nada "salta" quando o conteúdo chega.
- **Login e cadastro**: `AuthSkeleton` reproduz o `AuthShell` (coluna única centrada, sem painel lateral).
- **Landing**: `landing/app/loading.tsx` usa blocos `.lp-sk` (tinta sobre papel oliva, cantos em degrau, varrimento em passos). A landing mantém a sua paleta própria; o login e o cadastro para onde "Entrar" e "Começar a estudar" apontam são os do aluno.
- Todos respeitam `prefers-reduced-motion` e anunciam `role="status"` para leitores de ecrã.
## Checklist de conformidade (gestor e aluno)

- Cores só por token (`bg-card`, `text-muted-foreground`, `text-destructive`…). Nada de hex, `text-white` ou paletas do Tailwind.
- Contornos de 1px (`border`); `border-2` só em tracejados de largura de arrasto. Sem sombras duras nem cantos recortados.
- Controlos de formulário: `Input`, `Textarea`, `NativeSelect`, `Checkbox`, `Switch`. Nunca `<input>`/`<select>` crus (excepto `type=file` oculto).
- Acções: sempre `Button` (variantes `default`, `outline`, `ghost`, `destructive`). Botões crus só como alvo de clique com `focus-visible:ring`.
- A carregar: `Skeleton` com a forma do conteúdo (`TableRowsSkeleton`, `FormSkeleton`, `DetailSkeleton`, `DashboardSkeleton`); `Spinner` só dentro de botões que estão a executar uma acção.
- Texto: sem MAIÚSCULAS forçadas nem enums do backend à vista (traduzir: `MULTIPLE_CHOICE` → "Escolha múltipla"); números com `Intl.NumberFormat('pt-PT')`.
- Género nas mensagens: `gender()` / `newLabel()` em `lib/crud/entities.tsx`.
