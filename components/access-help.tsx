import { CONTACT_EMAIL } from '@/lib/constants';

/** «Problemas no acesso?» com o contacto da instalação, se houver (`NEXT_PUBLIC_CONTACT_EMAIL`); sem ele, não se inventa um endereço. */
export function AccessHelp() {
  return (
    <p className="text-center text-xs text-muted-foreground">
      Problemas no acesso?{' '}
      {CONTACT_EMAIL ? (
        <>
          Escreva para{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2 hover:text-foreground">
            {CONTACT_EMAIL}
          </a>
          .
        </>
      ) : (
        'Contacte o suporte técnico.'
      )}
    </p>
  );
}
