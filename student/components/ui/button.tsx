import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'px-btn',
        destructive: 'px-btn [--face:var(--destructive)] [--edge:#6e1a1e] [--face-hover:#d4494f]',
        outline: 'px-btn [--face:var(--card)] [--edge:var(--input)] [--txt:var(--foreground)] [--face-hover:var(--secondary)]',
        secondary: 'px-btn [--face:var(--secondary)] [--edge:var(--input)] [--txt:var(--secondary-foreground)] [--face-hover:var(--accent)]',
        ghost: 'rounded-full hover:bg-secondary',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        // Alvos de toque de 44 px (FE-25) so em ecra pequeno. Acima de `md`
        // volta a `h-9`/`h-10`, porque subir sempre parte a densidade das
        // tabelas do gestor, e a issue pede o telemovel.
        default: 'h-11 px-5 py-2 md:h-10',
        sm: 'h-11 gap-1.5 px-4 md:h-9',
        lg: 'h-12 px-7 text-[15px]',
        icon: 'size-11 md:size-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
