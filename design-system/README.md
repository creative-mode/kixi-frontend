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
- **Paleta:** o verde-musgo da landing é dominante, em vários tons (`background`, `card`, `accent`, `muted`, `primary` quase-preto). O amarelo `highlight` (+ `highlight-foreground`) é o toque disruptivo: usa-o em um ou dois elementos por ecrã (a CTA principal, o tiro da nave), nunca em superfícies grandes.
- **Estado (extensão Kixi):** `success`, `warning`, `info` e os fundos suaves `success-soft`, `warning-soft`, `info-soft`, `danger-soft`.
- **Raio:** `--radius: .625rem` (`rounded-md` = raio − 2px, `rounded-xl` = raio + 4px).
- **Tema:** claro por omissão; escuro com `data-theme="dark"` (ou `.dark`) no `<html>`. A preferência vive em `localStorage['kixi-theme']`, partilhada entre as apps porque correm na mesma origem.

Regra: nunca uses cores literais em componentes. Usa sempre o token (`text-destructive`, não `text-red-600`).

## Componentes (`components/ui`)

Base comum às duas apps: `Button` (default, secondary, outline, ghost, destructive, link; tamanhos sm/default/lg/icon), `Input`, `Label`, `Card`, `Badge` (default, secondary, outline, success, warning, info, destructive), `Table`, `Checkbox`.

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

Uma coluna centrada: a nave a disparar um tiro amarelo, cartão com borda de tinta, sombra dura e faixa hachurada (como a landing). Aluno: `student/components/AuthShell.tsx`; gestor: `app/login/page.tsx`.
