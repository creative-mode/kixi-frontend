import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from './label';

/** Campo de formulário: etiqueta, controlo, ajuda e erro ligados por id (acessível). */
function FieldGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="field-group" className={cn('grid gap-5', className)} {...props} />;
}
function Field({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="field" className={cn('grid gap-2', className)} {...props} />;
}
function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return <Label data-slot="field-label" className={className} {...props} />;
}
function FieldDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot="field-description" className={cn('text-[13px] leading-snug text-muted-foreground', className)} {...props} />;
}
function FieldError({ className, children, ...props }: React.ComponentProps<'p'>) {
  if (!children) return null;
  return (
    <p data-slot="field-error" role="alert" className={cn('flex items-start gap-1.5 text-[13px] font-medium text-destructive', className)} {...props}>
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export { Field, FieldGroup, FieldLabel, FieldDescription, FieldError };
