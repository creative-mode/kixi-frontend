import type { Metadata } from 'next';
import Link from 'next/link';
import ForbiddenScene from "../../landing/components/forbidden/forbidden-scene";
import { Header } from '../../landing/components/sections/Header';
import { LOGIN_URL } from '../../landing/lib/content';
import './landing.css';
import '../../landing/components/forbidden/forbidden.css';

export const metadata: Metadata = {
  title: '403 · Acesso não permitido',
  description: 'Área restrita do Kixi. A porta não abre para esta conta.',
};

type PageProps = { searchParams: Promise<{ reason?: string | string[] }> };

function button(href: string, label: string, outside = false) {
  const cls = 'kx-btn kx-btn--lg';
  const inner = <span className="kx-btn__label">{label}</span>;
  return (
    <span className="kx-btn-wrap kx-scope">
      {outside ? (
        <a href={href} className={cls} style={{ textDecoration: 'none' }}>
          {inner}
        </a>
      ) : (
        <Link href={href} className={cls} style={{ textDecoration: 'none' }}>
          {inner}
        </Link>
      )}
    </span>
  );
}

export default async function ForbiddenPage({ searchParams }: PageProps) {
  const raw = (await searchParams).reason;
  const reason = Array.isArray(raw) ? raw[0] : raw;
  const wrongRole = reason === 'role';

  const primary = wrongRole
    ? button('/exam-builder', 'Voltar ao meu painel')
    : button('/aluno/inicio', 'Ir para o caminho certo', true);

  const secondary = wrongRole
    ? button('/', 'Ver o painel')
    : button(LOGIN_URL, 'Entrar noutra conta', true);

  const hint = wrongRole
    ? 'Esta área é para quem gere o Kixi. O teu acesso chega até aqui.'
    : 'O teu acesso é do lado dos alunos. A porta do gestor fica fechada.';

  return (
    <ForbiddenScene header={<Header />} hint={hint} primary={primary} secondary={secondary} />
  );
}
