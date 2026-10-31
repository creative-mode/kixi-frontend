import { CrudTrash } from '@/components/crud/crud-trash';

export const metadata = { title: 'Lixeira · Enunciados · Kixi Manager' };

export default function StatementsTrashPage() {
  return <CrudTrash entityKey="statements" />;
}
