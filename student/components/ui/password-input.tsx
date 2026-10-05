'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './input';
import { cn } from '@/lib/utils';

/** Input de palavra-passe com botão para mostrar/ocultar. */
function PasswordInput({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} className={cn('pr-10', className)} {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export { PasswordInput };
