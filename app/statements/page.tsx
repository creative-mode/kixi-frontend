import { Suspense } from 'react';
import { StatementsManager } from '@/components/crud/statements-manager';

export const metadata = { title: 'Enunciados · Kixi Manager' };

// O filtro vive no endereço (`?filtro=`), que o componente lê no cliente: pede um `Suspense`.
export default function StatementsPage() {
  return (
    <Suspense>
      <StatementsManager />
    </Suspense>
  );
}
