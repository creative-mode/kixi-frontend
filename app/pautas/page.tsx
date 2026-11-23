import { TermSheetsView } from '@/components/term-sheets/term-sheets-view';
import { getCurrentUser } from '@/lib/auth.server';
import { normalizeRoles } from '@/lib/roles';
import { canExportSheets } from '@/lib/term-sheet-export';

export const metadata = { title: 'Pautas · Kixi Manager' };

export default async function TermSheetsPage() {
  // O botão de PDF é só de quem exporta (kixi-frontend#808); o backend volta a decidir em cada pedido.
  const user = await getCurrentUser();
  return <TermSheetsView canExport={canExportSheets(normalizeRoles(user?.roles))} />;
}
