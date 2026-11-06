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
  actions,
  footer,
  children,
}: {
  name: string;
  /** O texto de onde saem as iniciais quando não há foto (por omissão, o nome). */
  photoName?: string;
  photo?: string | null;
  verified?: boolean;
  verifiedLabel?: string;
  /** Botões à direita da foto (só o teu perfil os tem). */
  actions?: React.ReactNode;
  /** Por baixo do cabeçalho, ainda dentro da faixa (o editor do perfil). */
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section aria-label="Perfil" className="border-b border-[#eef0ec]">
      <div aria-hidden className="h-[148px] rounded-b-[24px] bg-[#dbe9d3]" />
      <div className="px-4 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
          <div className="-mt-12 w-fit rounded-full border-4 border-white bg-white shadow-[0_1px_3px_rgba(18,28,21,.12)]"><UserAvatar name={photoName ?? name} src={photo} size={100} /></div>
          {actions && <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{actions}</div>}
        </div>
        <h2 className="mt-2 flex items-center gap-1.5 text-[26px] leading-tight font-extrabold tracking-[-0.02em]">
          {name}
          {verified && <VerifiedBadge label={verifiedLabel} />}
        </h2>
        {children}
      </div>
      {footer}
    </section>
  );
}
