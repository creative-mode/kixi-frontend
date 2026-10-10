import type { ExamDraft, School } from '@/lib/exam/schools';


/**
 * Folha de prova no modelo oficial. O molde é fixo: só o logótipo, o nome da escola e a disciplina mudam
 * de uma escola/disciplina para outra; o resto (classe, fase, questões, regras, rodapé) é conteúdo da prova.
 * É um documento impresso, por isso usa preto sobre branco em vez dos tokens da interface.
 */
const BASE = '/manager';
const cell = 'border border-black';

export function ExamSheet({ school, draft }: { school: School | undefined; draft: ExamDraft }) {
  const schoolName = (school?.name || 'Nome da escola').toUpperCase();
  const subject = draft.subject || 'Disciplina';
  const items = draft.items.filter((i) => i.text.trim());
  const total = items.reduce((n, i) => n + (Number(i.points) || 0), 0);
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

      {items.length > 0 && (
        <ol className="mt-5 list-decimal space-y-3 pl-8 text-justify">
          {items.map((it, i) => (
            <li key={i}>
              {it.text}
              {it.points !== '' && <span className="whitespace-nowrap"> ({it.points} val.)</span>}
              {it.options.length > 0 && (
                // As opções vão na folha porque o aluno as recebe; a marcação da
                // correcta vai por baixo e é o que o `print:hidden` esconde — é a
                // diferença entre a folha que ele leva e a que o professor revê.
                <ul className="mt-1 list-none space-y-0.5 pl-4">
                  {it.options.map((o) => (
                    <li key={o.label} className="flex gap-2">
                      <span className="font-semibold">{o.label})</span>
                      <span>{o.text}</span>
                      {o.correct && <b className="whitespace-nowrap print:hidden">← correcta</b>}
                    </li>
                  ))}
                </ul>
              )}
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
