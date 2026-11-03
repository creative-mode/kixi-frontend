import { CrudList } from '@/components/crud/crud-list';

export const metadata = { title: 'Simulações · Kixi Manager' };

export default function SimulationsPage() {
  return <CrudList entityKey="simulations" />;
}
