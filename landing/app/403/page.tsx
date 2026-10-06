import type { Metadata } from 'next';
import Link from 'next/link';
import ForbiddenScene from '@/components/forbidden/forbidden-scene';
import { Header } from '@/components/sections/Header';
import { LOGIN_URL } from '@/lib/content';
import '@/components/forbidden/forbidden.css';

export const metadata: Metadata = {
  title: '403 · Acesso não permitido',
  description: 'Área restrita do Kixi. A porta não abre para esta conta.',
};

type PageProps = { searchParams: Promise<{ reason?: string | string[] }> };

function button(href: string, label: string) {
  return (
    <span className="kx-btn-wrap kx-scope">
      <Link href={href} className="kx-btn kx-btn--lg" style={{ textDecoration: 'none' }}>
        <span className="kx-btn__label">{label}</span>
      </Link>
    </span>
  );
}

export default async function ForbiddenPage({ searchParams }: PageProps) {
  const raw = (await searchParams).reason;
  const reason = Array.isArray(raw) ? raw[0] : raw;
  const wrongRole = reason === 'role';

  const primary = wrongRole
    ? button('/manager/exam-builder', 'Voltar ao meu painel')
    : button('/aluno/inicio', 'Ir para o caminho certo');

  const secondary = wrongRole
    ? button('/', 'Ver o site')
    : button(LOGIN_URL, 'Entrar noutra conta');

  const hint = wrongRole
    ? 'Esta área é para quem gere o Kixi. O teu acesso chega até aqui.'
    : 'O teu acesso é do lado dos alunos. Esta porta não abre para ti.';

  return (
    <ForbiddenScene header={<Header />} hint={hint} primary={primary} secondary={secondary} />
  );
}
