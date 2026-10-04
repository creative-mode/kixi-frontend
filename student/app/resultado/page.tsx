import Link from 'next/link';
import { Button, Card, Icon, Medal, ProgressBar, Reward } from '@/components/kixi';

export const metadata = { title: 'Resultado · Kixi' };

export default function Resultado() {
  return (
    <div className="screen kx-lcd">
      <main className="screen__main page--wide" style={{ paddingTop: 24 }}>
        <div className="result">
        <div className="result__col">
        <span className="eyebrow">Resultado · P1 Redes de Computadores</span>
        <div className="row" style={{ alignItems: 'flex-end', gap: 12 }}>
          <span style={{ font: '400 56px/56px var(--font-pixel)', letterSpacing: '-0.04em' }}>15,0</span>
          <span className="muted" style={{ font: '600 15px/24px var(--font-sans)', paddingBottom: 4 }}>/ 20 valores · +2,5 que a última</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, padding: '8px 0' }}>
          <Reward burst>+40 XP</Reward>
          <Reward icon="target" tone="pop">VLANs derrotado</Reward>
        </div>
        </div>
        <div className="result__col">
        <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span className="eyebrow">Domínio por tema</span>
          <ProgressBar label="VLANs" value={92} slim />
          <ProgressBar label="Roteamento" value={58} tone="tiro" slim />
          <ProgressBar label="Subnetting · a reforçar" value={34} tone="alvo" slim />
        </Card>
        <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <Medal name="Primeiro tiro" icon="target">Nova conquista</Medal>
          <div className="stack" style={{ gap: 6, paddingTop: 8 }}>
            <p style={{ margin: 0, font: '600 15px/22px var(--font-sans)' }}>Erraste 2 questões de Subnetting.</p>
            <p className="muted" style={{ margin: 0, font: '400 14px/22px var(--font-sans)' }}>O tutor explica cada uma a partir do enunciado.</p>
          </div>
        </div>
        </div>
        </div>
      </main>
      <footer className="screen__foot result__foot" style={{ flexDirection: 'column' }}>
        <span className="kx-btn-wrap kx-btn-wrap--block kx-scope">
          <Link href="/tutor" className="kx-btn btnlink"><span className="kx-btn__label"><Icon name="chat" size={16} />Rever erros com o tutor</span></Link>
        </span>
        <div style={{ display: 'flex', gap: 12 }}>
          <span className="kx-btn-wrap kx-scope" style={{ flexGrow: 1 }}>
            <Link href="/inicio" className="kx-btn kx-btn--gold btnlink"><span className="kx-btn__label"><Icon name="upload" size={16} />Partilhar na turma</span></Link>
          </span>
          <span className="kx-btn-wrap kx-scope">
            <Link href="/inicio" className="kx-btn kx-btn--secondary" style={{ textDecoration: 'none', font: '600 15px/1 var(--font-sans)' }}><span className="kx-btn__label">Fechar</span></Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
