import { Suspense } from 'react';
import { CrudList } from '@/components/crud/crud-list';

export const metadata = { title: 'Simulações · Kixi Manager' };

// A pesquisa pode vir no endereço (`?q=`), que o componente lê no cliente: pede um `Suspense`.
export default function SimulationsPage() {
  return (
    <Suspense>
      <CrudList entityKey="simulations" />
    </Suspense>
  );
}
