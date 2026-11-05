import { CrudTrash } from '@/components/crud/crud-trash';

export const metadata = { title: 'Lixeira · Simulações · Kixi Manager' };

export default function SimulationsTrashPage() {
  return <CrudTrash entityKey="simulations" />;
}
