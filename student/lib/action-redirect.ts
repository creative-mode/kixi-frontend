import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { actionDestination } from './action-destination';

/** `redirect()` para dentro de uma server action, certo tanto por `fetch` como por envio nativo do formulário. */
export async function redirectFromAction(path: string): Promise<never> {
  const viaClient = (await headers()).has('next-action');
  redirect(actionDestination(path, viaClient));
}
