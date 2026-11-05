'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { MouseEvent } from 'react';

type NavigationEntry = { url: string };
type NavigationApi = {
  currentEntry?: { index: number };
  entries?: () => NavigationEntry[];
};

function hasInternalPreviousPage(): boolean {
  const navigation = (window as Window & { navigation?: NavigationApi }).navigation;
  const currentIndex = navigation?.currentEntry?.index;
  const previousUrl = currentIndex !== undefined && currentIndex > 0
    ? navigation?.entries?.()[currentIndex - 1]?.url
    : undefined;
  const referrer = previousUrl ?? document.referrer;

  if (!referrer) return false;

  try {
    return new URL(referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function BackLink({ href }: { href: string }) {
  const router = useRouter();

  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || !hasInternalPreviousPage()
    ) return;

    event.preventDefault();
    router.back();
  }

  return (
    <Link
      href={href}
      onClick={goBack}
      aria-label="Voltar"
      className="grid size-11 shrink-0 place-items-center rounded-full transition-colors outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/40"
    >
      <ArrowLeft className="size-5" aria-hidden />
    </Link>
  );
}
