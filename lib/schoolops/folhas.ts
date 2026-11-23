// A digitalização das folhas de resposta (kixi-frontend#838): as regras que não dependem do Camunda nem do React, para
// o `node --test` chegar cá. O formulário «Digitalizar as folhas» do motor tem um campo de ficheiros (`folhasDigitalizadas`,
// `.png,.jpg,.jpeg,.pdf`, vários, obrigatório); cada ficheiro vai ao armazém de documentos do Camunda (`POST /v2/documents`)
// e a tarefa conclui-se com a lista das referências (`documentId`, `storeId`, `contentHash`), que é o que o motor lê
// (`ProvaWorkers.conteudo`).
import { componentesDe, type Componente } from './tarefas.ts';

const MB = 1024 * 1024;
/** Uma turma tem até umas dezenas de alunos, uma folha (imagem) cada, ou um PDF com todas. */
export const FOLHAS_MAX_FICHEIROS = 40;
/** O mesmo limite por ficheiro do upload OCR do gestor (lib/crud/ocr-files.ts). */
export const FOLHAS_MAX_BYTES = 15 * MB;
export const FOLHAS_MAX_TOTAL_BYTES = 100 * MB;
export const FOLHAS_EXTENSOES = ['.png', '.jpg', '.jpeg', '.pdf'];
/** Para o `accept` do input. */
export const FOLHAS_ACCEPT = FOLHAS_EXTENSOES.join(',');

type FicheiroLike = { name: string; size: number };

/** O nome do campo do form que recebe os ficheiros (`filepicker`), ou `null` se a tarefa não pede ficheiros. */
export function campoDeFicheiros(schema: Componente): string | null {
  const c = componentesDe(schema).find((x) => x.type === 'filepicker' && typeof x.key === 'string' && x.key);
  return c ? (c.key as string) : null;
}

/** O tipo pelo conteúdo (os primeiros bytes), não pelo nome nem pelo tipo que o browser declara: PNG, JPEG ou PDF. */
export function tipoPeloConteudo(bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'application/pdf' | null {
  const b = (...v: number[]) => v.every((x, i) => bytes[i] === x);
  if (b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (b(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (b(0x25, 0x50, 0x44, 0x46, 0x2d)) return 'application/pdf';
  return null;
}

const TIPOS = 'PNG, JPG ou PDF';

/** Porque é que um ficheiro não serve (nome, tamanho), ou `null`. O tipo pelo conteúdo confere-se no servidor. */
export function problemaDasFolhas(f: FicheiroLike): string | null {
  const nome = f.name.toLowerCase();
  if (!FOLHAS_EXTENSOES.some((e) => nome.endsWith(e))) return `«${f.name}»: só são aceites ficheiros ${TIPOS}.`;
  if (f.size <= 0) return `«${f.name}» está vazio.`;
  if (f.size > FOLHAS_MAX_BYTES) return `«${f.name}» ultrapassa os ${FOLHAS_MAX_BYTES / MB} MB.`;
  return null;
}

/** Junta `novos` aos ficheiros já escolhidos e diz porque ficou algum de fora. */
export function acrescentarFolhas<T extends FicheiroLike>(atuais: T[], novos: T[]): { folhas: T[]; recusadas: string[] } {
  const folhas = [...atuais];
  const recusadas: string[] = [];
  let total = folhas.reduce((a, x) => a + x.size, 0);
  for (const n of novos) {
    const problema = problemaDasFolhas(n);
    if (problema) recusadas.push(problema);
    else if (folhas.some((x) => x.name === n.name && x.size === n.size)) recusadas.push(`«${n.name}» já está na lista.`);
    else if (folhas.length >= FOLHAS_MAX_FICHEIROS) recusadas.push(`«${n.name}»: no máximo ${FOLHAS_MAX_FICHEIROS} ficheiros de cada vez.`);
    else if (total + n.size > FOLHAS_MAX_TOTAL_BYTES) recusadas.push(`«${n.name}»: o envio passaria dos ${FOLHAS_MAX_TOTAL_BYTES / MB} MB no total.`);
    else {
      folhas.push(n);
      total += n.size;
    }
  }
  return { folhas, recusadas };
}

/** A referência a um documento do Camunda, na forma que o formulário e o motor esperam. */
export type ReferenciaDocumento = {
  'camunda.document.type': 'camunda';
  storeId: string;
  documentId: string;
  contentHash: string;
  metadata: { fileName: string; contentType: string; size: number };
};

const texto = (v: unknown): string => (typeof v === 'string' ? v : '');

function metadadosDe(v: unknown): ReferenciaDocumento['metadata'] {
  const m = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { fileName: texto(m.fileName), contentType: texto(m.contentType), size: typeof m.size === 'number' && Number.isFinite(m.size) ? m.size : 0 };
}

/** O corpo de `POST /v2/documents` → a referência. Sem documento, armazém ou hash não há como o motor ler o ficheiro. */
export function referenciaDoDocumento(corpo: unknown): ReferenciaDocumento {
  const c = (corpo && typeof corpo === 'object' ? corpo : {}) as Record<string, unknown>;
  const documentId = texto(c.documentId);
  const storeId = texto(c.storeId);
  const contentHash = texto(c.contentHash);
  if (!documentId || !storeId || !contentHash) throw new Error('O Camunda não devolveu a referência completa do documento.');
  return { 'camunda.document.type': 'camunda', storeId, documentId, contentHash, metadata: metadadosDe(c.metadata) };
}

/** As variáveis com que a tarefa se conclui: a lista de referências sob o nome do campo do form. */
export const variaveisDeConclusao = (campo: string, referencias: ReferenciaDocumento[]): Record<string, unknown> => ({ [campo]: referencias });

/** O que o browser devolve ao concluir é conferido: só as referências com os campos conhecidos, e um número razoável delas. */
export function referenciasRecebidas(valor: unknown): { ok: true; referencias: ReferenciaDocumento[] } | { ok: false; erro: string } {
  if (!Array.isArray(valor) || valor.length === 0) return { ok: false, erro: 'Carregue pelo menos uma folha.' };
  if (valor.length > FOLHAS_MAX_FICHEIROS) return { ok: false, erro: `No máximo ${FOLHAS_MAX_FICHEIROS} ficheiros de cada vez.` };
  const referencias: ReferenciaDocumento[] = [];
  for (const v of valor) {
    try {
      referencias.push(referenciaDoDocumento(v));
    } catch {
      return { ok: false, erro: 'Uma das folhas carregadas é inválida. Carregue-a de novo.' };
    }
  }
  return { ok: true, referencias };
}
