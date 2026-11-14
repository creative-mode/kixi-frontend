'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  exactInstitution,
  filterInstitutions,
  institutionLabel,
  normalizeSearch,
  parseInstitutions,
  parseSessionInstitution,
  type InstitutionOption,
} from '@/lib/institutions';

type Load = 'loading' | 'ready' | 'failed';

interface Props {
  /** Id do campo visível; o formulário usa-o para o foco num erro. */
  inputId: string;
  /** Id da mensagem de erro (o `aria-describedby` do campo). */
  errorId: string;
  error?: string;
  /** Muda quando o formulário é limpo depois de uma doação; repõe a escolha. */
  resetKey?: number;
}

/**
 * A escola da doação (#763): uma lista com pesquisa e a opção «Outra».
 *
 * A lista só substitui o texto livre quando chega do backend. Sem
 * `/institutions/public` (creative-mode/kixi#597) ou com o serviço em baixo, o
 * campo é o de sempre: uma doação nunca fica bloqueada por falta de catálogo.
 * Quando há lista, o que segue é o nome canónico da escola e o seu id — não o
 * texto que a pessoa escreveu —, para não voltarem as variantes de grafia.
 */
export function InstitutionPicker({ inputId, errorId, error, resetKey = 0 }: Props) {
  const [load, setLoad] = useState<Load>('loading');
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [session, setSession] = useState<InstitutionOption | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<InstitutionOption | null>(null);
  const [other, setOther] = useState(false);
  const [freeName, setFreeName] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const closeTimer = useRef<number | null>(null);
  const touched = useRef(false);
  /** Alguém escreveu no texto livre enquanto a lista ainda vinha. */
  const typedBeforeList = useRef(false);
  /** A transição loading → ready só transporta o texto uma vez. */
  const carried = useRef(false);
  const lastReset = useRef(resetKey);
  const comboInput = useRef<HTMLInputElement>(null);
  const freeInput = useRef<HTMLInputElement>(null);
  const listboxId = `${inputId}-listbox`;
  const hintId = `${inputId}-hint`;
  const optionId = (index: number) => `${inputId}-option-${index}`;

  // A lista e a escola da sessão são pedidos independentes: uma pode chegar
  // antes da outra e ambas são opcionais.
  useEffect(() => {
    let alive = true;
    fetch('/api/institutions', { headers: { Accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!alive) return;
        const list = parseInstitutions(body);
        setInstitutions(list);
        setLoad(list.length > 0 ? 'ready' : 'failed');
      })
      .catch(() => {
        if (alive) setLoad('failed');
      });
    fetch('/api/doar/institution', { headers: { Accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (alive) setSession(parseSessionInstitution(body));
      })
      .catch(() => {
        // Sem sessão (ou sem backend) não há nada a propor.
      });
    return () => {
      alive = false;
    };
  }, []);

  // Quem já tem sessão encontra a sua escola escolhida, desde que ela esteja na
  // lista pública. A escolha de quem começou a escrever nunca é sobreposta.
  useEffect(() => {
    if (load !== 'ready' || !session || touched.current) return;
    const found = institutions.find((option) => option.id === session.id);
    if (!found) return;
    setSelected(found);
    setQuery(institutionLabel(found));
  }, [load, session, institutions]);

  // No texto livre, a escola da sessão é uma ajuda, não uma imposição: fica
  // escrita e a pessoa pode mudá-la. Isto só acontece enquanto não há lista.
  useEffect(() => {
    if (load === 'ready' || !session) return;
    setFreeName((current) => (current.trim() ? current : session.name));
  }, [load, session]);

  // #763: quem começa a escrever enquanto a lista carrega não perde o texto
  // quando o combobox aparece. Se o texto for uma escola da lista, passa a ser a
  // escolha canónica; se não for, o modo «Outra» conserva-o integralmente — só o
  // transformar em pesquisa faria a doação seguir sem nome.
  useEffect(() => {
    if (load !== 'ready' || carried.current) return;
    carried.current = true;
    if (!typedBeforeList.current) return;
    const typed = freeName.trim();
    if (!typed) return;
    const exact = exactInstitution(institutions, typed);
    if (exact) {
      setSelected(exact);
      setQuery(institutionLabel(exact));
      setOther(false);
      window.requestAnimationFrame(() => {
        const input = comboInput.current;
        if (!input) return;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      });
      return;
    }
    setSelected(null);
    setQuery('');
    setOther(true);
    window.requestAnimationFrame(() => freeInput.current?.focus());
  }, [load, freeName, institutions]);

  // Depois de uma doação, «Doar outro enunciado» limpa também esta escolha.
  useEffect(() => {
    // Comparar com o valor anterior, e não «primeira vez»: em desenvolvimento o
    // StrictMode corre os efeitos duas vezes e a pré-selecção não pode cair nisso.
    if (lastReset.current === resetKey) return;
    lastReset.current = resetKey;
    setQuery('');
    setSelected(null);
    setOther(false);
    setFreeName('');
    setOpen(false);
    setActive(-1);
    touched.current = true;
    typedBeforeList.current = false;
  }, [resetKey]);

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  const needle = selected ? '' : query;
  const filtered = useMemo(() => filterInstitutions(institutions, needle), [institutions, needle]);
  // A última opção da lista é sempre «Outra», que não é uma escola.
  const otherIndex = filtered.length;

  useEffect(() => {
    setActive((current) => (current > otherIndex ? otherIndex : current));
  }, [otherIndex]);

  function choose(option: InstitutionOption) {
    touched.current = true;
    setSelected(option);
    setQuery(institutionLabel(option));
    setOther(false);
    setOpen(false);
    setActive(-1);
  }

  function chooseOther() {
    touched.current = true;
    setSelected(null);
    setQuery('');
    setOther(true);
    setFreeName('');
    setOpen(false);
    setActive(-1);
    // A lista desaparece debaixo do foco: o texto livre é o campo seguinte.
    window.requestAnimationFrame(() => freeInput.current?.focus());
  }

  function backToList() {
    setOther(false);
    setQuery('');
    setOpen(true);
    setActive(-1);
    window.requestAnimationFrame(() => comboInput.current?.focus());
  }

  function selectAt(index: number) {
    if (index >= otherIndex) chooseOther();
    else if (filtered[index]) choose(filtered[index]);
  }

  function onInput(value: string) {
    touched.current = true;
    setQuery(value);
    setSelected(null);
    setOpen(true);
    setActive(-1);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((current) => (current < 0 ? 0 : Math.min(otherIndex, current + 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive((current) => (current < 0 ? otherIndex : Math.max(0, current - 1)));
    } else if (event.key === 'Home' && open) {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End' && open) {
      event.preventDefault();
      setActive(otherIndex);
    } else if (event.key === 'Enter') {
      // Enter escolhe; não envia a doação a meio do preenchimento.
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (active >= 0) {
        selectAt(active);
        return;
      }
      const exact = exactInstitution(institutions, query);
      if (exact) choose(exact);
      else if (filtered.length === 0) chooseOther();
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  function scheduleClose() {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
  }

  function keepOpen() {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }

  const chosenOffice = exactInstitution(institutions, freeName);
  const fallbackId =
    chosenOffice?.id ?? (session && normalizeSearch(session.name) === normalizeSearch(freeName) ? session.id : null);
  const readyChoice = load === 'ready' && !other;
  const submittedName = readyChoice ? (selected?.name ?? '') : (chosenOffice?.name ?? freeName.trim());
  const submittedId = readyChoice ? (selected?.id ?? null) : fallbackId;

  const describedBy = `${hintId}${error ? ` ${errorId}` : ''}`;
  const message =
    error && load === 'ready' && !other && !selected
      ? 'Escolhe uma escola da lista ou a opção «Outra».'
      : error;

  return (
    <div className="dn-combo">
      <label htmlFor={inputId}>Instituição *</label>

      {/* O que se envia vai por aqui: o texto visível pode ser uma pesquisa. */}
      <input type="hidden" name="institutionName" value={submittedName} />
      {submittedId !== null && <input type="hidden" name="institutionId" value={String(submittedId)} />}

      {readyChoice ? (
        <>
          <input
            ref={comboInput}
            id={inputId}
            data-field="institutionName"
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
            aria-describedby={describedBy}
            aria-invalid={message ? true : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder="Pesquisa a escola"
            value={query}
            onChange={(event) => onInput(event.target.value)}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onBlur={scheduleClose}
            onKeyDown={onKeyDown}
          />
          {open && (
            <ul
              className="dn-combo__list"
              id={listboxId}
              role="listbox"
              aria-label="Escolas"
            >
              {filtered.map((option, index) => (
                <li
                  key={option.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={selected?.id === option.id}
                  className={index === active ? 'dn-combo__option is-active' : 'dn-combo__option'}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={keepOpen}
                  onClick={() => choose(option)}
                >
                  <span>{option.name}</span>
                  {option.shortName && option.shortName !== option.name && (
                    <span className="dn-combo__short">{option.shortName}</span>
                  )}
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="dn-combo__empty" role="presentation">Nenhuma escola encontrada.</li>
              )}
              <li
                id={optionId(otherIndex)}
                role="option"
                aria-selected={other}
                className={otherIndex === active ? 'dn-combo__option dn-combo__other is-active' : 'dn-combo__option dn-combo__other'}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={keepOpen}
                onClick={chooseOther}
              >
                Outra escola…
              </li>
            </ul>
          )}
        </>
      ) : (
        <>
          <input
            ref={freeInput}
            id={inputId}
            data-field="institutionName"
            type="text"
            autoComplete="organization"
            maxLength={150}
            placeholder={load === 'failed' ? 'Escreve o nome da escola' : 'A carregar as escolas…'}
            aria-describedby={describedBy}
            aria-invalid={message ? true : undefined}
            value={freeName}
            onChange={(event) => {
              typedBeforeList.current = true;
              touched.current = true;
              setFreeName(event.target.value);
            }}
          />
          {other && (
            <button type="button" className="dn-combo__back" onClick={backToList}>
              Escolher da lista
            </button>
          )}
        </>
      )}

      <p className="dn-help dn-help--small" id={hintId} aria-live="polite">
        {load === 'loading'
          ? 'A carregar a lista de escolas…'
          : load === 'failed'
            ? 'A lista de escolas não está disponível; escreve o nome da escola.'
            : other
              ? 'Escreve o nome da escola que não está na lista.'
              : 'Escreve para procurar. Se a escola não estiver na lista, escolhe «Outra escola…».'}
      </p>
      {message && <p className="dn-err" id={errorId}>! {message}</p>}
    </div>
  );
}
