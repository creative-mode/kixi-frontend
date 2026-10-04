import { Bug } from './Bug';

const ITEMS = ['OCR', 'Tutor de IA', 'Salas de prova', 'Social learning', 'Dashboard', 'Provas reais'];

export function Marquee() {
  const row = (hidden: boolean) => (
    <ul className="marquee__row" aria-hidden={hidden || undefined}>
      {ITEMS.map((t, i) => (
        <li key={t}>
          <span>{t}</span>
          <Bug width={26} className={`marquee__bug marquee__bug--${i % 4}`} />
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
