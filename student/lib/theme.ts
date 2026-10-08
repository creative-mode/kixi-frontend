'use client';

import { useSyncExternalStore } from 'react';

/** The theme lives in the `data-theme` attribute of <html>, written by the inline
 *  script in app/layout.tsx before the first paint so the page never flashes. That
 *  attribute is an external store, not React state: reading it through
 *  useSyncExternalStore keeps the toggle in sync when it changes from anywhere — the
 *  switch itself, another screen, or another tab — instead of copying it into state
 *  once on mount. */

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const observer = new MutationObserver(() => listeners.forEach((listener) => listener()));
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    listeners.delete(onChange);
    observer.disconnect();
  };
}

const read = () => document.documentElement.getAttribute('data-theme') === 'dark';
/** Server and first client render agree on light; the attribute is corrected right
 *  after paint by the script, which then notifies the subscribers. */
const readServer = () => false;

export function useNightTheme(): boolean {
  return useSyncExternalStore(subscribe, read, readServer);
}

/** Flips the theme and remembers it, so the next visit starts on the same one. */
export function setTheme(night: boolean): void {
  const theme = night ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('kixi-theme', theme);
  } catch {
    /* modo privado ou quota */
  }
}
