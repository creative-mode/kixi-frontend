import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-[2px] border px-2 py-0.5 font-pixel text-[10px] leading-[14px] uppercase tracking-wider w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:outline-2 focus-visible:outline-ring aria-invalid:border-destructive transition-colors overflow-hidden',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
        secondary:
          'border-line-strong bg-secondary text-secondary-foreground [a&]:hover:bg-accent',
        success: 'border-current bg-brand-tint text-phosphor',
        warning: 'border-current bg-tiro-tint text-tiro-ink',
        info: 'border-current bg-radar-tint text-radar-ink',
        pop: 'border-current bg-pop-tint text-pop-ink',
        destructive:
          'border-current bg-alvo-tint text-alvo-ink [a&]:hover:brightness-105',
        outline:
          'text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
