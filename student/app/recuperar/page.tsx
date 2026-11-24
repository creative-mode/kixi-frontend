import Link from 'next/link';
import { AuthShell } from '@/components/AuthShell';

export const metadata = { title: 'Recuperar palavra-passe · Kixi' };

/** Ainda não há recuperação automática: o ecrã diz isso sem prometer um formulário e explica o caminho que existe
 *  (um professor ou a secretaria redefine a palavra-passe), para o aluno não ficar num beco sem saída (#A7). */
export default function Recuperar() {
  return (
    <AuthShell
      title="Esqueceste-te da palavra-passe?"
      lead="Por agora, quem a redefine é a tua escola."
      backToLanding
    >
      <div role="note" className="grid gap-3 rounded-md border border-primary/30 bg-primary/5 p-4 text-sm text-foreground">
        <p>Ainda não podes pedir uma nova palavra-passe aqui. Para voltares a entrar:</p>
        <ol className="grid list-decimal gap-1.5 pl-5">
          <li>Fala com o teu professor ou com a secretaria da escola e pede que redefinam a palavra-passe da tua conta.</li>
          <li>Indica o teu nome e a turma, para te encontrarem depressa.</li>
          <li>Quando te derem a nova palavra-passe, entra e escolhe uma que só tu saibas.</li>
        </ol>
      </div>
      <Link href="/entrar" className="inline-flex min-h-11 items-center justify-center rounded-md border px-4 text-sm font-semibold text-primary">
        Voltar a entrar
      </Link>
    </AuthShell>
  );
}
