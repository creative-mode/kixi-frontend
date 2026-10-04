import { Icon } from '@/components/kixi';
import { AUDIENCES } from '@/lib/content';

export function Audiences() {
  return (
    <section className="section section--light" aria-labelledby="aud-title">
      <div className="wrap">
        <p className="eyebrow">Para quem é</p>
        <h2 id="aud-title" className="h2">Cada um ganha o seu tempo de volta.</h2>
        <div className="aud">
          {AUDIENCES.map((a) => (
            <article key={a.id} id={a.id} className="aud__col">
              <h3 className="aud__title">{a.title}</h3>
              <p className="aud__lead">{a.lead}</p>
              <ul className="ticks">
                {a.items.map((it) => (
                  <li key={it}><Icon name="check" size={16} /><span>{it}</span></li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
