import { itemLabel, kindOf, totalScore, trueFalseAnswer, type DraftOption } from '@/lib/exam/draft';
import type { ExamDraft, ExamItem, School } from '@/lib/exam/schools';


/**
 * Folha de prova no modelo oficial. O molde é fixo: só o logótipo, o nome da escola e a disciplina mudam
 * de uma escola/disciplina para outra; o resto (classe, fase, questões, regras, rodapé) é conteúdo da prova.
 * É um documento impresso, por isso usa preto sobre branco em vez dos tokens da interface.
 */
const BASE = '/manager';

/** O que a folha diz da resposta certa: `never` é a folha que o aluno leva (sem chave); `screen` é a do construtor
 *  (a chave vê-se no ecrã e não sai na impressão); `always` é a chave (sai também impressa). */
export type KeyMode = 'never' | 'screen' | 'always';
const keyClass = (mode: KeyMode) => (mode === 'screen' ? 'print:hidden' : '');
const cell = 'border border-black';

/** As linhas onde o aluno escreve uma resposta aberta. */
function AnswerLines({ count = 3 }: { count?: number }) {
  return (
    <span aria-hidden className="mt-1 block">
      {Array.from({ length: count }, (_, i) => <span key={i} className="block h-5 border-b border-black/40" />)}
    </span>
  );
}

/** As opções vão na folha porque o aluno as recebe; a marcação da correcta vai por baixo e é o que o
 *  `print:hidden` esconde — é a diferença entre a folha que ele leva e a que o professor revê. */
function Options({ options, mode }: { options: DraftOption[]; mode: KeyMode }) {
  const showKey = mode !== 'never';
  return (
    <ul className="mt-1 list-none space-y-0.5 pl-4">
      {options.map((o) => (
        <li key={o.label} className={`flex gap-2 ${showKey && o.correct ? `font-semibold text-green-700 ${keyClass(mode)}`.trim() : ''}`}>
          <span className="font-semibold">{o.label})</span>
          <span>{o.text}</span>
          {showKey && o.correct && <b className={`whitespace-nowrap ${keyClass(mode)}`}>correcta</b>}
        </li>
      ))}
    </ul>
  );
}

/** O «( )» de uma afirmação de verdadeiro/falso; na chave leva o V ou o F. */
function TrueFalseMark({ options, mode }: { options: DraftOption[]; mode: KeyMode }) {
  const answer = mode === 'never' ? null : trueFalseAnswer(options);
  return answer ? <span className={`whitespace-nowrap font-bold text-green-700 ${keyClass(mode)}`}> ({answer})</span> : <span className="whitespace-nowrap"> (&nbsp;&nbsp;&nbsp;)</span>;
}

/** A resposta esperada de uma questão aberta: só na chave. */
function ModelAnswer({ text, mode }: { text?: string; mode: KeyMode }) {
  if (mode === 'never' || !text?.trim()) return null;
  return <span className={`mt-1 block text-[12.5px] text-green-800 ${keyClass(mode)}`}><b>Resposta esperada:</b> {text.trim()}</span>;
}

const score = (points: number | '') => (points !== '' ? <span className="whitespace-nowrap"> ({points} val.)</span> : null);

/** As figuras da questão (as que o OCR recortou), logo a seguir ao enunciado, como no papel. */
function Figures({ item }: { item: ExamItem }) {
  const images = item.images ?? [];
  if (images.length === 0) return null;
  return (
    <span className="my-1.5 flex flex-wrap gap-2">
      {images.map((image, k) => (
        <img key={k} src={image.dataUrl} alt={image.caption} className="max-h-40 max-w-full object-contain" />
      ))}
    </span>
  );
}

/** Uma questão no papel: o enunciado e, conforme o tipo, as linhas de resposta, as opções ou as alíneas. */
function Question({ item, mode }: { item: ExamItem; mode: KeyMode }) {
  const kind = kindOf(item);
  if (kind === 'group') {
    const subs = (item.items ?? []).filter((x) => x.text.trim());
    return (
      <>
        {item.text}
        <Figures item={item} />
        {subs.length > 0 && (
          <ol className="mt-1 list-none space-y-1.5 pl-2">
            {subs.map((sub, j) => {
              const k = kindOf(sub);
              return (
                <li key={j} className="flex gap-2">
                  <span className="font-semibold">{itemLabel(j)})</span>
                  <span className="flex-1">
                    {sub.text}
                    {k === 'true_false' && <TrueFalseMark options={sub.options} mode={mode} />}
                    {score(sub.points)}
                    {k === 'multiple_choice' && <Options options={sub.options} mode={mode} />}
                    {k === 'open' && <><AnswerLines count={2} /><ModelAnswer text={sub.modelAnswer} mode={mode} /></>}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </>
    );
  }
  return (
    <>
      {item.text}
      <Figures item={item} />
      {kind === 'true_false' && <TrueFalseMark options={item.options} mode={mode} />}
      {score(item.points)}
      {kind === 'multiple_choice' && item.options.length > 0 && <Options options={item.options} mode={mode} />}
      {kind === 'open' && <><AnswerLines /><ModelAnswer text={item.modelAnswer} mode={mode} /></>}
    </>
  );
}

export function ExamSheet({ school, draft, keyMode = 'screen' }: { school: School | undefined; draft: ExamDraft; keyMode?: KeyMode }) {
  const schoolName = (school?.name || 'Nome da escola').toUpperCase();
  const subject = draft.subject || 'Disciplina';
  const items = draft.items.filter((i) => i.text.trim());
  const total = totalScore(draft.items);
  const meta = [draft.duration !== '' ? `Duração: ${draft.duration} min` : '', draft.variant.trim() ? `Série ${draft.variant.trim()}` : '', draft.schoolYear.trim() ? `Ano letivo ${draft.schoolYear.trim()}` : ''].filter(Boolean).join(' · ');
  const rules = draft.rules.filter((r) => r.trim());

  return (
    <article id="exam-sheet" aria-label="Pré-visualização da prova" className="mx-auto w-full max-w-[794px] bg-white p-[8%] text-[13px] leading-relaxed text-black shadow-sm [font-family:Arial,Helvetica,sans-serif]">
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className={`${cell} w-[15%] p-1.5 text-center align-middle`}>
              {school?.logo ? <img src={school.logo} alt={`Logótipo ${school.name}`} className="mx-auto max-h-16 w-auto object-contain" /> : null}
            </td>
            <td className={`${cell} p-1.5 text-center align-middle [font-family:'Times_New_Roman',Times,serif] text-[10px] leading-snug`}>
              <img src={`${BASE}/exam/brasao.png`} alt="" className="mx-auto mb-1 h-9 w-auto" />
              <div>REPÚBLICA DE ANGOLA</div>
              <div>MINISTÉRIO DA EDUCAÇÃO</div>
              <div>{schoolName}</div>
            </td>
            <td className={`${cell} w-[15%]`} />
          </tr>
          <tr className="text-center text-[11px]">
            <td className={`${cell} px-1 py-0.5 font-semibold uppercase`}>{draft.grade}</td>
            <td className={`${cell} px-1 py-0.5 uppercase`}>{draft.kind} – {subject}</td>
            <td className={`${cell} px-1 py-0.5 font-semibold uppercase`}>{draft.phase}</td>
          </tr>
        </tbody>
      </table>

      {meta && <p className="mt-2 text-center text-[11px] font-semibold uppercase">{meta}</p>}

      {items.length > 0 && (
        <ol className="mt-5 list-decimal space-y-3 pl-8 text-justify">
          {items.map((it, i) => (
            <li key={i}>
              <Question item={it} mode={keyMode} />
            </li>
          ))}
        </ol>
      )}
      {total > 0 && <p className="mt-3 text-right text-xs font-semibold">Total: {total} valores</p>}

      {rules.length > 0 && (
        <section className="mt-6">
          <p className="mb-1 font-bold">Regras:</p>
          <ol className="list-decimal space-y-1.5 pl-6">{rules.map((r, i) => <li key={i}>{r}</li>)}</ol>
        </section>
      )}
      {draft.note.trim() && <p className="mt-4 font-bold">Obs: {draft.note}</p>}

      <footer className="mt-14 text-center text-[11px] font-bold uppercase [font-family:'Times_New_Roman',Times,serif]">
        <p>
          {schoolName}, em {draft.place || '—'}{draft.date ? `, aos ${new Date(draft.date + 'T00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }).replace(/ de /g, ' DE ').toUpperCase()}` : ''}.
        </p>
        <p className="mt-6">O Professor</p>
        <p className="underline">{draft.teacher || '________________'}</p>
      </footer>
    </article>
  );
}
