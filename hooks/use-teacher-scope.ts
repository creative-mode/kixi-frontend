'use client';

import { useCallback, useEffect, useState } from 'react';
import { myTeachingScope, type Result } from '@/app/actions/crud';
import { closedScope, type TeachingScope } from '@/lib/crud/teacher-scope';

export {
  answerInScope,
  classInScope,
  simulationInScope,
  statementInScope,
} from '@/lib/crud/teacher-scope';

/** Um pedido por sessão de browser, partilhado por todos os componentes da página.
 *
 * O cache vive aqui, no cliente, e não ao lado da server action: uma variável de
 * módulo num ficheiro `use server` é partilhada por todos os utilizadores que o
 * processo serve, e daria o scope de um professor ao seguinte. No browser é por
 * sessão: um professor com uma atribuição nova vê-a depois de recarregar. */
let scopeOnce: Promise<Result<TeachingScope>> | null = null;
/** Geração do pedido em voo: um retry mais novo invalida o anterior, e o fim do
 *  anterior nunca apaga o cache do mais novo (corrida entre o `catch` e o `retry`). */
let scopeToken = 0;

function loadScopeOnce(): Promise<Result<TeachingScope>> {
  if (!scopeOnce) {
    const geracao = ++scopeToken;
    scopeOnce = myTeachingScope().then(
      (res): Result<TeachingScope> => {
        // A falha não fica em cache: sem isto, um erro na primeira leitura
        // fechava o scope para a sessão inteira, sem saída a não ser recarregar.
        if (!res.ok && geracao === scopeToken) scopeOnce = null;
        return res;
      },
      (err: unknown): Result<TeachingScope> => {
        // A rede lança no cliente, fora do `guard` do servidor: sem este `catch`
        // a promessa rejeitava, o efeito nunca definia `scope.error`, as listas
        // ficavam no esqueleto para sempre e o retry nunca aparecia.
        if (geracao === scopeToken) scopeOnce = null;
        const msg = err instanceof Error && err.message ? err.message : '';
        return { ok: false, error: msg || 'Não foi possível contactar o servidor.' };
      },
    );
  }
  return scopeOnce;
}

/** Esquece o scope em cache. Chamado no logout, para a próxima conta no mesmo
 *  separador não herdar a da anterior. */
export function resetTeacherScope() {
  scopeOnce = null;
}

/** O scope do professor atual. `scope` a `null` quer dizer "ainda por resolver",
 *  e os filtros escondem tudo nesse estado: as listas mostram o esqueleto até ele
 *  chegar, em vez de pintarem a escola inteira durante um instante.
 *
 *  `retry` limpa o erro e volta a pedir: é o que o botão "Tentar novamente"
 *  chama quando a leitura do scope falha. */
export function useTeacherScope(): { scope: TeachingScope | null; retry: () => void } {
  const [scope, setScope] = useState<TeachingScope | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    loadScopeOnce().then((res) => {
      if (!alive) return;
      setScope(res.ok ? res.data : closedScope(res.error));
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    scopeOnce = null;
    // O esqueleto volta enquanto se lê de novo: é no handler, não no efeito.
    setScope(null);
    setAttempt((n) => n + 1);
  }, []);

  return { scope, retry };
}
