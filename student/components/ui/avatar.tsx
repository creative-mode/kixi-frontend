'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@/lib/utils';

function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return <AvatarPrimitive.Root data-slot="avatar" className={cn('relative flex size-10 shrink-0 overflow-hidden rounded-full', className)} {...props} />;
}
function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  // `object-cover` e obrigatorio: sem ele o `object-fit` omisso e `fill`, que
  // estica a imagem para a caixa em vez de a escalar. Com `aspect-square`, uma
  // fotografia normal (3:4, 4:3) saia achatada, e o `rounded-full` da raiz cortava
  // o resultado ja deslocado — o topo da cabeca ficava fora do circulo. E o texto
  // que o editor mostra com `object-cover` ficava certo, o que explica a foto
  // parecer certa aqui e deformada nos avatares.
  return <AvatarPrimitive.Image data-slot="avatar-image" className={cn('aspect-square size-full object-cover', className)} {...props} />;
}
function AvatarFallback({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return <AvatarPrimitive.Fallback data-slot="avatar-fallback" className={cn('flex size-full items-center justify-center rounded-full bg-accent font-bold text-accent-foreground', className)} {...props} />;
}

export { Avatar, AvatarImage, AvatarFallback };
