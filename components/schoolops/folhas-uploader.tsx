'use client';

import { useId, useRef, useState } from 'react';
import { CircleCheck, FileText, LoaderCircle, TriangleAlert, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { carregarFolha, concluirComFolhas } from '@/app/actions/schoolops';
import {
  acrescentarFolhas,
  FOLHAS_ACCEPT,
  FOLHAS_MAX_BYTES,
  FOLHAS_MAX_FICHEIROS,
  progressoDoEnvio,
  type EstadoDaFolha,
  type ReferenciaDocumento,
} from '@/lib/schoolops/folhas';

type Folha = { id: number; ficheiro: File; estado: EstadoDaFolha; erro?: string; referencia?: ReferenciaDocumento };

const MB = 1024 * 1024;
const tamanho = (n: number) => (n >= MB ? `${(n / MB).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * «Digitalizar as folhas» no ecrã do gestor (kixi-frontend#838): o professor escolhe as imagens ou PDF, cada ficheiro vai
 * ao Camunda por uma Server Action (o token fica no servidor), e a tarefa conclui-se com as referências. Os ficheiros já
 * enviados não se repetem numa nova tentativa, e não há duplo envio.
 */
export function FolhasUploader({ chave, onConcluida }: { chave: string; onConcluida: () => void }) {
  const inputId = useId();
  const proximo = useRef(1);
  const emCurso = useRef(false);
  const [folhas, setFolhas] = useState<Folha[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const progresso = progressoDoEnvio(folhas.map((f) => f.estado));
  const mexe = (id: number, p: Partial<Folha>) => setFolhas((l) => l.map((f) => (f.id === id ? { ...f, ...p } : f)));

  function escolher(lista: FileList | null) {
    if (!lista || emCurso.current) return;
    const novos = Array.from(lista);
    const { folhas: aceites, recusadas } = acrescentarFolhas(folhas.map((f) => f.ficheiro), novos);
    setAvisos(recusadas);
    setErro(null);
    const jaCá = new Set(folhas.map((f) => f.ficheiro));
    setFolhas((l) => [...l, ...aceites.filter((x) => !jaCá.has(x)).map((ficheiro) => ({ id: proximo.current++, ficheiro, estado: 'por-enviar' as const }))]);
  }

  function retirar(id: number) {
    if (emCurso.current) return;
    setFolhas((l) => l.filter((f) => f.id !== id));
    setErro(null);
  }

  async function enviar() {
    if (emCurso.current || folhas.length === 0) return; // o ref trava o duplo clique antes de o estado actualizar
    emCurso.current = true;
    setAEnviar(true);
    setErro(null);
    try {
      const referencias: ReferenciaDocumento[] = [];
      for (const f of folhas) {
        if (f.estado === 'enviada' && f.referencia) {
          referencias.push(f.referencia);
          continue;
        }
        mexe(f.id, { estado: 'a-enviar', erro: undefined });
        try {
          const corpo = new FormData();
          corpo.append('file', f.ficheiro);
          const r = await carregarFolha(chave, corpo);
          if (!r.ok) {
            mexe(f.id, { estado: 'erro', erro: r.error });
            setErro('Nem todas as folhas foram enviadas. Retire ou substitua as que falharam e tente de novo: as já enviadas não se repetem.');
            return;
          }
          mexe(f.id, { estado: 'enviada', referencia: r.data });
          referencias.push(r.data);
        } catch {
          mexe(f.id, { estado: 'erro', erro: 'Falhou a ligação ao servidor.' });
          setErro('Falhou a ligação ao servidor. Tente de novo: as folhas já enviadas não se repetem.');
          return;
        }
      }
      try {
        const r = await concluirComFolhas(chave, referencias);
        if (r.ok) {
          onConcluida();
          return;
        }
        setErro(r.error);
      } catch {
        setErro('Não foi possível concluir a tarefa. Tente de novo: as folhas já estão enviadas.');
      }
    } finally {
      emCurso.current = false;
      setAEnviar(false);
    }
  }

  return (
    <div className="grid gap-4 text-sm" data-testid="folhas-uploader">
      <div className="grid gap-2">
        <label htmlFor={inputId} className="font-medium">Folhas digitalizadas</label>
        <p id={`${inputId}-ajuda`} className="text-muted-foreground">
          Imagens PNG ou JPG, ou PDF: uma por folha ou um PDF com todas. Até {FOLHAS_MAX_FICHEIROS} ficheiros, {FOLHAS_MAX_BYTES / MB} MB cada.
        </p>
        <input
          id={inputId}
          type="file"
          multiple
          accept={FOLHAS_ACCEPT}
          disabled={aEnviar}
          aria-describedby={`${inputId}-ajuda`}
          onChange={(e) => {
            escolher(e.target.files);
            e.target.value = ''; // permite voltar a escolher o mesmo ficheiro depois de o retirar
          }}
          className="block w-full max-w-md cursor-pointer rounded-md border border-input bg-background text-sm file:mr-3 file:cursor-pointer file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      {avisos.length > 0 ? (
        <ul role="alert" className="grid gap-1 rounded-md border border-destructive/40 bg-danger-soft p-3 text-destructive" data-testid="folhas-avisos">
          {avisos.map((a) => <li key={a}>{a}</li>)}
        </ul>
      ) : null}

      {folhas.length > 0 ? (
        <ul className="grid gap-1.5" aria-label="Folhas escolhidas">
          {folhas.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-md border px-3 py-2" data-estado={f.estado}>
              <FileText size={16} aria-hidden className="shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate" title={f.ficheiro.name}>{f.ficheiro.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{tamanho(f.ficheiro.size)}</span>
              {f.estado === 'a-enviar' ? <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground"><LoaderCircle size={14} className="animate-spin" aria-hidden />A enviar…</span> : null}
              {f.estado === 'enviada' ? <span className="inline-flex shrink-0 items-center gap-1 text-success"><CircleCheck size={14} aria-hidden />Enviada</span> : null}
              {f.estado === 'erro' ? <span className="inline-flex shrink-0 items-center gap-1 text-destructive"><TriangleAlert size={14} aria-hidden />{f.erro ?? 'Erro'}</span> : null}
              {f.estado !== 'enviada' ? (
                <button type="button" onClick={() => retirar(f.id)} disabled={aEnviar} aria-label={`Retirar ${f.ficheiro.name}`} className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-40">
                  <X size={14} aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {aEnviar || progresso.enviadas > 0 ? (
        <div className="grid gap-1" data-testid="folhas-progresso">
          <div role="progressbar" aria-label="Progresso do envio" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progresso.percentagem} className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${progresso.percentagem}%` }} />
          </div>
          <p role="status" className="text-muted-foreground">{progresso.texto}</p>
        </div>
      ) : null}

      {erro ? <p role="alert" className="text-destructive" data-testid="folhas-erro">{erro}</p> : null}

      <div>
        <Button type="button" onClick={() => void enviar()} disabled={aEnviar || folhas.length === 0} data-testid="folhas-enviar">
          {aEnviar ? <LoaderCircle className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
          {aEnviar ? 'A enviar as folhas…' : erro ? 'Tentar de novo' : 'Enviar folhas e concluir'}
        </Button>
      </div>
    </div>
  );
}
