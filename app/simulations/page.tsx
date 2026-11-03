import { Suspense } from 'react';
import { CrudList } from '@/components/crud/crud-list';

export const metadata = { title: 'Simulações · Kixi Manager' };

// A pesquisa, a ordenação e a página vivem no endereço (`?q=&sort=&dir=&page=`),
// que o componente lê no cliente: pede um `Suspense`.
export default function SimulationsPage() {
  return (
    <Suspense>
      <CrudList entityKey="simulations" />
    </Suspense>
  );
}
