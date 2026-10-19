'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col gap-0', className)} {...props} />;
}
/** Variante "line": separadores sublinhados, como numa rede social. */
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List data-slot="tabs-list" className={cn('flex w-full items-stretch overflow-x-auto border-b border-border [scrollbar-width:none]', className)} {...props} />;
}
function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'relative inline-flex h-[53px] min-w-fit flex-1 shrink-0 items-center justify-center whitespace-nowrap px-2.5 text-[15px] sm:px-4 font-semibold hover:bg-secondary/60 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50 data-[state=active]:text-foreground',
        "data-[state=active]:font-bold after:absolute after:bottom-0 after:left-1/2 after:h-1 after:w-14 after:-translate-x-1/2 after:rounded-full after:bg-primary after:opacity-0 data-[state=active]:after:opacity-100 after:content-['']",
        className,
      )}
      {...props}
    />
  );
}
function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn('flex-1 outline-none', className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
