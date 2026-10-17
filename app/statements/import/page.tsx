import { redirect } from 'next/navigation';

export const metadata = { title: 'Importar enunciados · Kixi Manager' };

/** Importar uma prova passou a ser um passo do construtor: o OCR preenche o rascunho e é lá que se corrige.
 *  O endereço fica para não partir os marcadores de quem já o tinha. */
export default function ImportStatementPage() {
  redirect('/exam-builder?importar=1');
}
