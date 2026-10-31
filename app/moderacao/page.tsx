import { Suspense } from 'react';
import { ModerationQueue } from '@/components/moderation/moderation-queue';

export const metadata = { title: 'Moderação · Kixi Manager' };

// O separador e a página vivem no endereço, que o componente lê no cliente: pede um `Suspense`.
export default function ModeracaoPage() {
  return (
    <Suspense>
      <ModerationQueue />
    </Suspense>
  );
}
