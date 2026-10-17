import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { CONTACT_EMAIL } from '@/lib/content';

const TITLE = 'Privacidade · Kixi';
const DESCRIPTION = 'Que dados do Kixi recolhemos, porquê, por quanto tempo os guardamos e como exerces os teus direitos.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/privacidade' },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/privacidade', locale: 'pt_AO', type: 'website', siteName: 'Kixi' },
};

export default function Privacidade() {
  return (
    <LegalPage title="Privacidade" updated="17 de outubro de 2026">
      <p>
        O Kixi é feito por alunos do ITEL, para alunos. Tratamos dados de estudantes, por isso dizemos aqui, sem juridiquês,
        o que guardamos, para quê e por quanto tempo. Seguimos a Lei da Proteção de Dados Pessoais de Angola (Lei n.º 22/11).
      </p>

      <h2>Quem é o responsável</h2>
      <p>
        O responsável pelos dados é a @creativemode, que desenvolve o Kixi.
        {CONTACT_EMAIL ? <> Podes falar connosco em <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</> : <> O contacto para estes assuntos está indicado no rodapé do site.</>}
      </p>

      <h2>Que dados recolhemos e porquê</h2>
      <div className="lg-tablewrap">
        <table>
          <thead><tr><th>Dados</th><th>Para quê</th></tr></thead>
          <tbody>
            <tr><td>Conta: nome, número de processo ou email, palavra-passe (guardada cifrada) e foto, se a colocares</td><td>Criar e proteger a tua conta e entrar no Kixi</td></tr>
            <tr><td>Escola, curso, turma e ano letivo</td><td>Mostrar-te as provas e o feed da tua turma e da tua escola</td></tr>
            <tr><td>Desempenho: simulações, notas, pontos, medalhas e sequência de estudo</td><td>Corrigir, mostrar a tua evolução e o ranking</td></tr>
            <tr><td>Publicações, comentários e conversas com o tutor</td><td>Fazer funcionar o feed e o tutor de IA</td></tr>
            <tr><td>Doações de enunciados: ficheiro e, se deixares, um contacto</td><td>Tratar o enunciado doado e, se for preciso, falar contigo</td></tr>
          </tbody>
        </table>
      </div>
      <p>Não vendemos dados e não os usamos para publicidade.</p>

      <h2>Quanto tempo guardamos</h2>
      <ul>
        <li>A conta e o desempenho, enquanto a conta existir.</li>
        <li>Contas sem atividade durante 24 meses são apagadas ou anonimizadas.</li>
        <li>Doações recusadas e respetivos contactos, 90 dias.</li>
        <li>Registos técnicos de segurança, 90 dias.</li>
      </ul>

      <h2>Menores de 18 anos</h2>
      <p>
        Muitos alunos são menores. Quem tem menos de 18 anos só deve criar conta com o conhecimento e a autorização do
        encarregado de educação, que pode pedir o acesso, a correção ou o apagamento dos dados do menor a qualquer
        momento, através do contacto acima. A escola pode igualmente ajudar nesse pedido.
      </p>

      <h2>Os teus direitos</h2>
      <ul>
        <li>Saber que dados temos sobre ti e receber uma cópia.</li>
        <li>Corrigir dados errados.</li>
        <li>Pedir o apagamento da conta e dos dados.</li>
        <li>Opor-te a um tratamento e retirar um consentimento, quando for essa a base.</li>
      </ul>
      <p>
        Respondemos aos pedidos o mais depressa possível. Se achares que não tratámos bem os teus dados, podes queixar-te
        à Agência de Proteção de Dados de Angola.
      </p>

      <h2>Cookies e estatísticas</h2>
      <p>
        O site só usa estatísticas se aceitares. Recusar não tira nada ao Kixi. Vê o detalhe em <a href="/cookies">Cookies</a>.
      </p>
    </LegalPage>
  );
}
