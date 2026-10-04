import { Sprite } from './Bug';

const ITEMS = ['OCR', 'Tutor de IA', 'Salas de prova', 'Social learning', 'Dashboard', 'Provas reais'];

export function Marquee() {
  const row = (hidden: boolean) => (
    <ul className="marquee__row" aria-hidden={hidden || undefined}>
      {ITEMS.map((t, i) => (
        <li key={t}>
          <span>{t}</span>
          <Sprite kind={(['fly', 'moth', 'ship'] as const)[i % 3]} width={i % 3 === 2 ? 30 : 24} className="marquee__bug" />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="marquee" role="presentation">
      <div className="marquee__track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
