import * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-[54px] w-full min-w-0 rounded-[14px] border-[1.5px] border-[#dde3da] bg-white px-4 py-2 text-base text-[#121c15] transition-[color,box-shadow] outline-none placeholder:text-muted-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-[#1f5a2c] focus-visible:ring-[3px] focus-visible:ring-[rgba(31,90,44,.15)]',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
