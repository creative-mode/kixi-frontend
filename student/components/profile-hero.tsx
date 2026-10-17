import { UserAvatar } from '@/components/user-avatar';
import { VerifiedBadge } from '@/components/verified-badge';

/**
 * O cabeçalho comum a todos os perfis: faixa, foto (ou logótipo) grande sobreposta, nome com selo,
 * e o que é próprio de cada perfil (factos, etiquetas, ações) como filhos. O perfil de uma pessoa
 * e o de uma escola usam-no, para parecerem da mesma casa.
 */
export function ProfileHero({
  name,
  photoName,
  photo,
  verified,
  verifiedLabel,
  children,
}: {
  name: string;
  /** O texto de onde saem as iniciais quando não há foto (por omissão, o nome). */
  photoName?: string;
  photo?: string | null;
  verified?: boolean;
  verifiedLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <section aria-label="Perfil" className="border-b">
      <div aria-hidden className="h-32 bg-gradient-to-br from-accent to-secondary" />
      <div className="px-4 pb-4">
        <div className="-mt-12 w-fit rounded-full border-4 border-background bg-background"><UserAvatar name={photoName ?? name} src={photo} size={88} /></div>
        <h2 className="mt-2 flex items-center gap-1.5 text-xl leading-tight font-extrabold tracking-tight">
          {name}
          {verified && <VerifiedBadge label={verifiedLabel} />}
        </h2>
        {children}
      </div>
    </section>
  );
}
