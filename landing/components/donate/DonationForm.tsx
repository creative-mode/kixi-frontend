'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  ACCEPT_ATTR,
  CONSENT_TEXT_VERSION,
  EXAM_TYPES,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  readFields,
  validateFields,
  validateFiles,
  type FieldErrors,
} from '@/lib/donation-rules';
import { inspectImage, messageFor, type Assessment } from '@/lib/image-quality';
import { imagesFrom } from '@/lib/clipboard-images';
import { EVENTS, track } from '@/lib/analytics';

type Phase = 'editing' | 'sending' | 'done';

const STEPS = ['ENUNCIADO', 'ORIGEM', 'ENVIO'] as const;
const STEP_FIELDS: (keyof FieldErrors)[][] = [
  ['files'],
  ['institutionName', 'subjectName', 'examType', 'classGrade', 'schoolYear'],
  ['donorName', 'donorEmail', 'notes', 'consent'],
];

const keyOf = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;

function size(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function DonationForm() {
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const startedAt = useRef<number>(0);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('editing');
  const [progress, setProgress] = useState(0);
  const [reference, setReference] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState(0);
  // Veredicto da análise de cada foto (undefined = ainda a analisar); os PDFs não são analisados.
  const [checks, setChecks] = useState<Record<string, Assessment | null>>({});
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);
  const heading = useRef<HTMLLegendElement>(null);

  // O momento em que o formulário apareceu: o backend recusa quem preenche mais depressa que uma pessoa.
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  // O `addFiles` fecha sobre os ficheiros atuais; o ouvinte de `paste` lê sempre o mais recente.
  const addFilesRef = useRef(addFiles);
  useEffect(() => { addFilesRef.current = addFiles; });

  // Colar uma imagem (Ctrl+V, ou uma captura no telemóvel) entra pela mesma via dos ficheiros
  // escolhidos: mesmas regras de tipo, tamanho e número, e a mesma análise de qualidade.
  // Ouve-se a janela porque a área dos ficheiros não recebe foco por si — assim o Ctrl+V
  // funciona em qualquer ponto do primeiro ecrã, e o texto colado nos campos segue normal.
  useEffect(() => {
    if (phase !== 'editing' || step !== 0) return;
    function onPaste(event: ClipboardEvent) {
      const items = event.clipboardData ? Array.from(event.clipboardData.items) : [];
      const images = imagesFrom(items);
      if (images.length === 0) return;
      event.preventDefault();
      addFilesRef.current(images);
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [phase, step]);

  // O temporizador do «Copiado!» não pode sobreviver ao ecrã.
  useEffect(() => () => { if (copyTimer.current !== null) window.clearTimeout(copyTimer.current); }, []);

  const id = (name: string) => `${uid}-${name}`;
  const describe = (name: keyof FieldErrors) => (errors[name] ? `${id(name)}-err` : undefined);

  function addFiles(list: FileList | readonly File[] | null) {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (!next.some((f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) next.push(file);
    }
    const added = next.filter((f) => !files.includes(f));
    setFiles(next);
    setErrors((e) => ({ ...e, files: validateFiles(next) ?? undefined }));
    if (picker.current) picker.current.value = '';
    for (const file of added) {
      void inspectImage(file).then((result) => setChecks((c) => ({ ...c, [keyOf(file)]: result })));
    }
  }

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    setChecks((c) => { const { [keyOf(files[index])]: _gone, ...rest } = c; return rest; });
    setErrors((e) => ({ ...e, files: next.length ? validateFiles(next) ?? undefined : undefined }));
  }

  /** Copia a referência; se o clipboard não existir ou for negado, fica a seleção à mão como saída. */
  async function copyReference() {
    if (!reference) return;
    try {
      if (!navigator.clipboard?.writeText) return;
      await navigator.clipboard.writeText(reference);
    } catch {
      return;
    }
    setCopied(true);
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
  }

  function send(form: FormData) {
    setPhase('sending');
    setProgress(0);
    setProblem(null);
    const request = new XMLHttpRequest();
    request.open('POST', '/api/doar');
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => {
      setPhase('editing');
      setProblem('Sem ligação. Verifica a internet e tenta outra vez; os ficheiros continuam aqui.');
    };
    request.onload = () => {
      let body: { reference?: string; error?: string; fieldErrors?: FieldErrors } = {};
      try {
        body = JSON.parse(request.responseText);
      } catch {
        // resposta que não é nossa: cai na mensagem genérica abaixo
      }
      if (request.status === 201 && body.reference) {
        setReference(body.reference);
        setPhase('done');
        // Mínimo da v1 (#219): a doação foi mesmo aceite (referência devolvida), sem PII.
        track(EVENTS.donationSubmitted);
        return;
      }
      setPhase('editing');
      if (body.fieldErrors) setErrors(body.fieldErrors);
      setProblem(body.error ?? 'Não foi possível enviar agora. Tenta outra vez daqui a pouco.');
    };
    request.send(form);
  }

  /** Fotos que não servem (ou ainda em análise) impedem de avançar; as com só um aviso passam. */
  function photoProblem(): string | null {
    if (files.some((f) => !(keyOf(f) in checks))) return 'A analisar as fotos… tenta outra vez num segundo.';
    if (files.some((f) => checks[keyOf(f)]?.verdict === 'reject')) return 'Há fotos que não servem. Troca ou remove as assinaladas.';
    return null;
  }

  /** Muda de ecrã e põe o foco no primeiro campo com erro, ou no título do ecrã. */
  function goTo(next: number, field?: string) {
    setStep(next);
    requestAnimationFrame(() => {
      const target = field ? formRef.current?.querySelector<HTMLElement>(`[data-field="${field}"]`) : null;
      (target ?? heading.current)?.focus();
    });
  }

  /** Valida só os campos do ecrã atual antes de avançar. */
  function next() {
    const data = new FormData(formRef.current!);
    const fields = readFields((name) => (name === 'consent' ? (data.get('consent') ? 'true' : '') : data.get(name)));
    const found: FieldErrors = validateFields(fields);
    const filesError = validateFiles(files);
    if (filesError) found.files = filesError;
    if (step === 0 && !found.files) {
      const problem = photoProblem();
      if (problem) found.files = problem;
    }
    const mine = STEP_FIELDS[step].filter((n) => found[n]);
    setErrors((e) => {
      const cleared = { ...e };
      for (const n of STEP_FIELDS[step]) delete cleared[n];
      for (const n of mine) cleared[n] = found[n];
      return cleared;
    });
    if (mine.length > 0) {
      setProblem(null);
      goTo(step, mine[0]);
      return;
    }
    setProblem(null);
    goTo(step + 1);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase === 'sending') return;
    const data = new FormData(event.currentTarget);
    const fields = readFields((name) => (name === 'consent' ? (data.get('consent') ? 'true' : '') : data.get(name)));
    const found: FieldErrors = validateFields(fields);
    const filesError = validateFiles(files) ?? photoProblem();
    if (filesError) found.files = filesError;
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setProblem('Confirma os campos assinalados.');
      const at = STEP_FIELDS.findIndex((names) => names.some((n) => found[n]));
      goTo(at < 0 ? step : at, Object.keys(found)[0]);
      return;
    }
    const outgoing = new FormData();
    for (const [key, value] of Object.entries(fields)) outgoing.append(key, String(value));
    outgoing.set('website', String(data.get('website') ?? ''));
    outgoing.set('formStartedAt', String(startedAt.current));
    for (const file of files) outgoing.append('files', file, file.name);
    send(outgoing);
  }

  if (phase === 'done' && reference) {
    return (
      <div className="dn-console" data-state="done">
        <div className="dn-screenwrap"><div className="dn-lcd dn-done" role="status" aria-live="polite" tabIndex={-1}>
          <h2 className="dn-done__title">Recebido. Obrigado!</h2>
          <div className="dn-done__refrow">
            <p className="dn-done__ref" aria-label={`Referência ${reference}`}>{reference}</p>
            <span className="kx-btn-wrap kx-scope">
              <button
                type="button"
                className="kx-btn kx-btn--sm kx-btn--secondary"
                onClick={copyReference}
                aria-label="Copiar referência"
              >
                <span className="kx-btn__label">{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </span>
          </div>
          <p className="dn-done__text">
            Guarda este código: é com ele que falas connosco sobre esta doação. Vamos rever o enunciado antes de o publicar.
          </p>
        </div></div>
        <div className="dn-pad">
          <span className="kx-btn-wrap kx-scope"><button
            type="button"
            className="kx-btn kx-btn--a"
            onClick={() => {
              setFiles([]);
              setErrors({});
              setProblem(null);
              setReference(null);
              setCopied(false);
              if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
              setPhase('editing');
              setStep(0);
              startedAt.current = Date.now();
              formRef.current?.reset();
            }}
          >
            <span className="kx-btn__label">Doar outro enunciado</span>
          </button></span>
        </div>
      </div>
    );
  }

  const sending = phase === 'sending';
  const last = step === STEPS.length - 1;
  const fieldError = (name: keyof FieldErrors) =>
    errors[name] ? <p className="dn-err" id={`${id(name)}-err`}>! {errors[name]}</p> : null;
  const total = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <form ref={formRef} className="dn-console" onSubmit={onSubmit} noValidate aria-busy={sending}>
      <div className="dn-label">
        <div className="dn-pips" role="img" aria-label={`Passo ${step + 1} de ${STEPS.length}`}>{STEPS.map((name, i) => <span key={name} className={i <= step ? 'is-on' : ''} />)}</div>
      </div>

      <div className="dn-screenwrap"><div className="dn-lcd">
        <noscript>
          <p className="dn-err">Este formulário precisa de JavaScript para enviar os ficheiros.</p>
        </noscript>

        {/* Os três ecrãs ficam no formulário (só um visível): o envio leva sempre todos os campos. */}
        <fieldset className="dn-screen" hidden={step !== 0} disabled={sending}>
          <legend className="dn-legend" tabIndex={-1} ref={step === 0 ? heading : undefined}>Insere o enunciado</legend>
          <div
            className={`dn-drop${dragging ? ' dn-drop--over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          >
            <label htmlFor={id('files')} className="dn-drop__label">
              <span className="dn-drop__title">{files.length ? 'Juntar mais folhas' : 'Toca para escolher fotos ou PDF'}</span>
              <span className="dn-drop__hint">
                JPG, PNG, WEBP ou PDF · até {MAX_FILES} ficheiros · {MAX_FILE_BYTES / (1024 * 1024)} MB cada
              </span>
              <span className="dn-drop__tip">Folha inteira, em pé, com luz e sem tremer. Ou cola com Ctrl+V (Cmd+V no Mac).</span>
            </label>
            <input
              ref={picker}
              id={id('files')}
              data-field="files"
              className="dn-drop__input"
              type="file"
              multiple
              accept={ACCEPT_ATTR}
              onChange={(e) => addFiles(e.target.files)}
              aria-describedby={describe('files')}
              aria-invalid={errors.files ? true : undefined}
            />
          </div>
          {fieldError('files')}
          {files.length > 0 && (
            <>
              <p className="dn-count">{files.length} {files.length === 1 ? 'folha' : 'folhas'} · {size(total)}</p>
              <ul className="dn-files" aria-label="Ficheiros escolhidos">
                {files.map((file, index) => {
                  const check = checks[keyOf(file)];
                  const note = check ? messageFor(check) : null;
                  const tone = check?.verdict === 'reject' ? 'bad' : check?.verdict === 'warn' ? 'warn' : 'ok';
                  return (
                  <li key={keyOf(file)} className={`dn-files__item dn-files__item--${tone}`}>
                    <span className="dn-files__name">{file.name}</span>
                    <span className="dn-files__size">{keyOf(file) in checks ? size(file.size) : 'a analisar…'}</span>
                    <button type="button" className="dn-files__remove" onClick={() => removeFile(index)} aria-label={`Remover ${file.name}`}>×</button>
                    {note && <span className="dn-files__note" role={tone === 'bad' ? 'alert' : undefined}>{tone === 'bad' ? 'x ' : '! '}{note}</span>}
                  </li>
                  );
                })}
              </ul>
            </>
          )}
        </fieldset>

        <fieldset className="dn-screen" hidden={step !== 1} disabled={sending}>
          <legend className="dn-legend" tabIndex={-1} ref={step === 1 ? heading : undefined}>De onde vem?</legend>
          <div className="dn-grid">
            <div className="dn-field dn-field--wide">
              <label htmlFor={id('institutionName')}>Instituição *</label>
              <input id={id('institutionName')} data-field="institutionName" name="institutionName" maxLength={150} autoComplete="organization"
                aria-describedby={describe('institutionName')} aria-invalid={errors.institutionName ? true : undefined} />
              {fieldError('institutionName')}
            </div>
            <div className="dn-field">
              <label htmlFor={id('subjectName')}>Disciplina *</label>
              <input id={id('subjectName')} data-field="subjectName" name="subjectName" maxLength={100}
                aria-describedby={describe('subjectName')} aria-invalid={errors.subjectName ? true : undefined} />
              {fieldError('subjectName')}
            </div>
            <div className="dn-field">
              <label htmlFor={id('examType')}>Tipo de prova *</label>
              <select id={id('examType')} data-field="examType" name="examType" defaultValue=""
                aria-describedby={describe('examType')} aria-invalid={errors.examType ? true : undefined}>
                <option value="" disabled>Escolhe…</option>
                {EXAM_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              {fieldError('examType')}
            </div>
            <div className="dn-field">
              <label htmlFor={id('classGrade')}>Classe ou turma</label>
              <input id={id('classGrade')} data-field="classGrade" name="classGrade" maxLength={50} placeholder="12ª Classe"
                aria-describedby={describe('classGrade')} aria-invalid={errors.classGrade ? true : undefined} />
              {fieldError('classGrade')}
            </div>
            <div className="dn-field">
              <label htmlFor={id('schoolYear')}>Ano lectivo</label>
              <input id={id('schoolYear')} data-field="schoolYear" name="schoolYear" maxLength={9} placeholder="2024/2025" inputMode="numeric"
                aria-describedby={describe('schoolYear')} aria-invalid={errors.schoolYear ? true : undefined} />
              {fieldError('schoolYear')}
            </div>
          </div>
        </fieldset>

        <fieldset className="dn-screen" hidden={step !== 2} disabled={sending}>
          <legend className="dn-legend" tabIndex={-1} ref={step === 2 ? heading : undefined}>Quase lá</legend>
          <p className="dn-help">Podes doar sem dizer quem és. Se deixares o e-mail, só o usamos para falar desta doação.</p>
          <div className="dn-grid">
            <div className="dn-field">
              <label htmlFor={id('donorName')}>Nome (opcional)</label>
              <input id={id('donorName')} data-field="donorName" name="donorName" maxLength={100} autoComplete="name"
                aria-describedby={describe('donorName')} aria-invalid={errors.donorName ? true : undefined} />
              {fieldError('donorName')}
            </div>
            <div className="dn-field">
              <label htmlFor={id('donorEmail')}>E-mail (opcional)</label>
              <input id={id('donorEmail')} data-field="donorEmail" name="donorEmail" type="email" maxLength={150} autoComplete="email"
                aria-describedby={describe('donorEmail')} aria-invalid={errors.donorEmail ? true : undefined} />
              {fieldError('donorEmail')}
            </div>
            <div className="dn-field dn-field--wide">
              <label htmlFor={id('notes')}>Notas (opcional)</label>
              <textarea id={id('notes')} data-field="notes" name="notes" rows={2} maxLength={1000}
                aria-describedby={describe('notes')} aria-invalid={errors.notes ? true : undefined} />
              {fieldError('notes')}
            </div>
          </div>

          {/* Armadilha para robôs: uma pessoa nunca o vê nem o preenche. */}
          <div className="dn-trap" aria-hidden="true">
            <label>
              Website
              <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
            </label>
          </div>

          <div className="dn-consent">
            <label className="dn-consent__row">
              <input type="checkbox" name="consent" data-field="consent" aria-describedby={describe('consent')} aria-invalid={errors.consent ? true : undefined} />
              <span>
                Tenho direito a partilhar este enunciado e aceito que o Kixi o reveja, o trate (incluindo leitura automática do texto)
                e o publique na plataforma para estudo. Se deixei o e-mail, aceito ser contactado sobre esta doação. *
              </span>
            </label>
            {fieldError('consent')}
            <p className="dn-help dn-help--small">
              Não guardamos o teu endereço de rede, só uma marca irreversível para travar abusos. Consentimento v{CONSENT_TEXT_VERSION}.
            </p>
          </div>
        </fieldset>

        <div className="dn-live" role="alert" aria-live="assertive">
          {problem && <p className="dn-problem">{problem}</p>}
        </div>

        {sending && (
          <div className="dn-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="A enviar">
            <div className="dn-progress__bar" style={{ width: `${progress}%` }} />
            <span>{progress < 100 ? `A enviar… ${progress}%` : 'A processar…'}</span>
          </div>
        )}
      </div></div>

      <div className="dn-pad">
        {step > 0 && (
          <span className="kx-btn-wrap kx-scope">
            <button type="button" className="kx-btn kx-btn--secondary" onClick={() => goTo(step - 1)} disabled={sending}>
              <span className="kx-btn__label">Voltar</span>
            </button>
          </span>
        )}
        <span className="kx-btn-wrap kx-scope dn-pad__next">
          {last ? (
            <button key="enviar" type="submit" className="kx-btn kx-btn--a" disabled={sending}>
              <span className="kx-btn__label">{sending ? 'A enviar…' : 'Doar'}</span>
            </button>
          ) : (
            <button key="continuar" type="button" className="kx-btn kx-btn--a" onClick={next} disabled={sending}>
              <span className="kx-btn__label">Continuar</span>
            </button>
          )}
        </span>
      </div>
    </form>
  );
}
