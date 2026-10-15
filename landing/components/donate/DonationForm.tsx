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

type Phase = 'editing' | 'sending' | 'done';

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

  // O momento em que o formulário apareceu: o backend recusa quem preenche mais depressa que uma pessoa.
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const id = (name: string) => `${uid}-${name}`;
  const describe = (name: keyof FieldErrors) => (errors[name] ? `${id(name)}-err` : undefined);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (!next.some((f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) next.push(file);
    }
    setFiles(next);
    setErrors((e) => ({ ...e, files: validateFiles(next) ?? undefined }));
    if (picker.current) picker.current.value = '';
  }

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    setErrors((e) => ({ ...e, files: next.length ? validateFiles(next) ?? undefined : undefined }));
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
        return;
      }
      setPhase('editing');
      if (body.fieldErrors) setErrors(body.fieldErrors);
      setProblem(body.error ?? 'Não foi possível enviar agora. Tenta outra vez daqui a pouco.');
    };
    request.send(form);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase === 'sending') return;
    const data = new FormData(event.currentTarget);
    const fields = readFields((name) => (name === 'consent' ? (data.get('consent') ? 'true' : '') : data.get(name)));
    const found: FieldErrors = validateFields(fields);
    const filesError = validateFiles(files);
    if (filesError) found.files = filesError;
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setProblem('Confirma os campos assinalados.');
      const first = Object.keys(found)[0];
      const target = formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`);
      target?.focus();
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
      <div className="dn-card dn-done" role="status" aria-live="polite" tabIndex={-1}>
        <p className="dn-done__tag">Recebido</p>
        <h2 className="dn-done__title">Obrigado. A tua doação já chegou.</h2>
        <p className="dn-done__ref">Referência <strong>{reference}</strong></p>
        <p className="dn-done__text">
          Vamos rever o enunciado antes de o publicar. Guarda esta referência: é com ela que podes falar connosco sobre esta doação.
        </p>
        <span className="kx-btn-wrap kx-scope">
          <button
            type="button"
            className="kx-btn kx-btn--a"
            onClick={() => {
              setFiles([]);
              setErrors({});
              setProblem(null);
              setReference(null);
              setPhase('editing');
              startedAt.current = Date.now();
              formRef.current?.reset();
            }}
          >
            <span className="kx-btn__label">Doar outro enunciado</span>
          </button>
        </span>
      </div>
    );
  }

  const sending = phase === 'sending';
  const fieldError = (name: keyof FieldErrors) =>
    errors[name] ? <p className="dn-err" id={`${id(name)}-err`}>{errors[name]}</p> : null;

  return (
    <form ref={formRef} className="dn-card dn-form" onSubmit={onSubmit} noValidate aria-busy={sending}>
      <noscript>
        <p className="dn-err">Este formulário precisa de JavaScript para enviar os ficheiros.</p>
      </noscript>

      <fieldset className="dn-group" disabled={sending}>
        <legend className="dn-legend">1 · O enunciado</legend>

        <div
          className={`dn-drop${dragging ? ' dn-drop--over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        >
          <label htmlFor={id('files')} className="dn-drop__label">
            <span className="dn-drop__title">Escolhe as fotos ou o PDF</span>
            <span className="dn-drop__hint">
              JPG, PNG, WEBP ou PDF · até {MAX_FILES} ficheiros · {MAX_FILE_BYTES / (1024 * 1024)} MB cada · {MAX_TOTAL_BYTES / (1024 * 1024)} MB no total
            </span>
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
          <ul className="dn-files" aria-label="Ficheiros escolhidos">
            {files.map((file, index) => (
              <li key={`${file.name}-${file.size}-${file.lastModified}`} className="dn-files__item">
                <span className="dn-files__name">{file.name}</span>
                <span className="dn-files__size">{size(file.size)}</span>
                <button type="button" className="dn-files__remove" onClick={() => removeFile(index)} aria-label={`Remover ${file.name}`}>
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <fieldset className="dn-group" disabled={sending}>
        <legend className="dn-legend">2 · De onde vem</legend>
        <div className="dn-grid">
          <div className="dn-field">
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
        <div className="dn-field">
          <label htmlFor={id('notes')}>Notas (opcional)</label>
          <textarea id={id('notes')} data-field="notes" name="notes" rows={3} maxLength={1000}
            aria-describedby={describe('notes')} aria-invalid={errors.notes ? true : undefined} />
          {fieldError('notes')}
        </div>
      </fieldset>

      <fieldset className="dn-group" disabled={sending}>
        <legend className="dn-legend">3 · Quem doa (opcional)</legend>
        <p className="dn-help">Podes doar sem dizer quem és. Se deixares o e-mail, só o usamos para falar desta doação.</p>
        <div className="dn-grid">
          <div className="dn-field">
            <label htmlFor={id('donorName')}>Nome</label>
            <input id={id('donorName')} data-field="donorName" name="donorName" maxLength={100} autoComplete="name"
              aria-describedby={describe('donorName')} aria-invalid={errors.donorName ? true : undefined} />
            {fieldError('donorName')}
          </div>
          <div className="dn-field">
            <label htmlFor={id('donorEmail')}>E-mail</label>
            <input id={id('donorEmail')} data-field="donorEmail" name="donorEmail" type="email" maxLength={150} autoComplete="email"
              aria-describedby={describe('donorEmail')} aria-invalid={errors.donorEmail ? true : undefined} />
            {fieldError('donorEmail')}
          </div>
        </div>
      </fieldset>

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
          Não guardamos o teu endereço de rede, só uma marca irreversível para travar abusos. Texto de consentimento v{CONSENT_TEXT_VERSION}.
        </p>
      </div>

      <div className="dn-live" role="alert" aria-live="assertive">
        {problem && <p className="dn-problem">{problem}</p>}
      </div>

      {sending && (
        <div className="dn-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="A enviar">
          <div className="dn-progress__bar" style={{ width: `${progress}%` }} />
          <span>{progress < 100 ? `A enviar… ${progress}%` : 'A processar…'}</span>
        </div>
      )}

      <span className="kx-btn-wrap kx-btn-wrap--block kx-scope">
        <button type="submit" className="kx-btn kx-btn--a" disabled={sending}>
          <span className="kx-btn__label">{sending ? 'A enviar…' : 'Doar enunciado'}</span>
        </button>
      </span>
    </form>
  );
}
