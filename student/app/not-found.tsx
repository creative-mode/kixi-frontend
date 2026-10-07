import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/states';

/** 404 do app do aluno: página não existe ou foi movida. */
export default function NotFound() {
  return (
    <main className="mx-auto grid w-full max-w-[760px] place-items-center p-4 py-16 md:p-7">
      <div className="w-full rounded-xl border bg-card px-5 py-6">
        <EmptyState
          title="Esta página não existe"
          message="Pode ter sido movida ou o endereço está incompleto. Volta ao início e continua de onde paraste."
          action={
            <Button asChild>
              <Link href="/inicio">Voltar ao início</Link>
            </Button>
          }
        />
      </div>
    </main>
  );
}
