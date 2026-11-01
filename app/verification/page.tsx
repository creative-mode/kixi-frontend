import { Suspense } from 'react';
import { VerificationList } from '@/components/verification/verification-list';

export const metadata = { title: 'Verificação · Kixi Manager' };

// O filtro e a página vivem no endereço, que o componente lê no cliente: pede um `Suspense`.
export default function VerificationPage() {
  return (
    <Suspense>
      <VerificationList />
    </Suspense>
  );
}
