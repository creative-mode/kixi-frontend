import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { CookieSettings } from '@/components/consent/CookieSettings';

const TITLE = 'Cookies · Kixi';
const DESCRIPTION = 'Que cookies e armazenamento local o Kixi usa, para quê e por quanto tempo.';

/** Cache partilhada (#522): HTML público igual para toda a gente. */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/cookies' },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/cookies', locale: 'pt_AO', type: 'website', siteName: 'Kixi' },
};

export default function Cookies() {
  return (
    <LegalPage title="Cookies" updated="17 de outubro de 2026">
      <p>
        Usamos o mínimo. Os necessários fazem o site funcionar e não pedem permissão. As estatísticas só ligam se aceitares,
        e podes mudar de ideias quando quiseres.
      </p>

      <div className="lg-tablewrap" role="region" aria-label="Tabela de cookies" tabIndex={0}>
        <table>
          <thead><tr><th>Nome</th><th>Finalidade</th><th>Tipo</th><th>Duração</th></tr></thead>
          <tbody>
            <tr><td>auth_token</td><td>Manter a tua sessão iniciada na app</td><td>Necessário</td><td>Sessão</td></tr>
            <tr><td>kixi-consent</td><td>Lembrar a tua escolha sobre cookies</td><td>Necessário (armazenamento local)</td><td>Até a apagares</td></tr>
            <tr><td>kixi-reduce-motion</td><td>Lembrar a preferência de reduzir movimento</td><td>Preferência (armazenamento local)</td><td>Até a apagares</td></tr>
            <tr><td>_ga, _ga_*</td><td>Estatísticas anónimas de utilização, com o Google Analytics (IP anonimizado, sem publicidade)</td><td>Analítica, só com consentimento</td><td>Até 2 anos</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Mudar a tua escolha</h2>
      <p>
        Se recusares, não é feito nenhum pedido a terceiros e o Kixi funciona na mesma. Para mudar de escolha:{' '}
        <CookieSettings className="lg-linkbtn" />.
      </p>
    </LegalPage>
  );
}
