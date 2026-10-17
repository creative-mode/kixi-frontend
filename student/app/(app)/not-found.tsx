import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/states';

/** 404 dentro da área autenticada: o Shell já tem o `main`, por isso aqui não há outro. */
export default function NotFound() {
  return (
    <div className="p-4 py-16">
      <h1 className="sr-only">Página não encontrada</h1>
      <div className="w-full rounded-xl border bg-card px-5 py-6">
        <EmptyState
          title="Esta página não existe"
          message="Pode ter sido movida ou o endereço está incompleto. Volta ao início e continua de onde paraste."
          action={<Button asChild><Link href="/inicio">Voltar ao início</Link></Button>}
        />
      </div>
    </div>
  );
}
