import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[4px] border-2 border-b-4 text-sm font-semibold transition-[transform,background-color,border-width] active:translate-y-[3px] active:border-b-[1px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'border-brand-edge bg-primary text-primary-foreground hover:bg-[var(--brand-hover)]',
        gold: 'border-tiro-edge bg-tiro text-on-tiro hover:brightness-105',
        destructive:
          'border-alvo-edge bg-destructive text-destructive-foreground hover:brightness-105',
        outline:
          'border-border bg-card text-foreground hover:bg-accent',
        secondary:
          'border-border bg-secondary text-secondary-foreground hover:bg-accent',
        ghost:
          'border-transparent border-b-2 hover:bg-accent hover:text-accent-foreground active:border-b-[1px]',
        link: 'border-transparent border-b-2 text-phosphor underline-offset-4 hover:underline active:translate-y-0',
      },
      size: {
        default: 'h-10 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 gap-1.5 px-3 text-[13px] has-[>svg]:px-2.5',
        lg: 'h-12 px-6 text-base has-[>svg]:px-4',
        icon: 'size-10',
        'icon-sm': 'size-8',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
