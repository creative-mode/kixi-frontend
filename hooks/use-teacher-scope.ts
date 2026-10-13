'use client';

import { useEffect, useState } from 'react';
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

function loadScopeOnce(): Promise<Result<TeachingScope>> {
  scopeOnce ??= myTeachingScope();
  return scopeOnce;
}

/** Esquece o scope em cache. Chamado no logout, para a próxima conta no mesmo
 *  separador não herdar o da anterior. */
export function resetTeacherScope() {
  scopeOnce = null;
}

/** O scope do professor atual. `null` quer dizer "ainda por resolver", e os
 *  filtros escondem tudo nesse estado: as listas mostram o esqueleto até ele
 *  chegar, em vez de pintarem a escola inteira durante um instante. */
export function useTeacherScope(): TeachingScope | null {
  const [scope, setScope] = useState<TeachingScope | null>(null);
  useEffect(() => {
    let alive = true;
    loadScopeOnce().then((res) => {
      if (!alive) return;
      setScope(res.ok ? res.data : closedScope(res.error));
    });
    return () => {
      alive = false;
    };
  }, []);
  return scope;
}
