import { Suspense } from 'react';
import { CoordinationView } from '@/components/coordination/coordination-view';

export const metadata = { title: 'Salas da instituição · Kixi Manager' };

// O filtro e a página vivem no endereço, que o componente lê no cliente: pede um `Suspense`.
export default function CoordinationPage() {
  return (
    <Suspense>
      <CoordinationView />
    </Suspense>
  );
}
