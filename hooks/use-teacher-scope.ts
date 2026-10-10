'use client';

import { useEffect, useState } from 'react';
import { myTeachingScope, type Result, type TeachingScope } from '@/app/actions/crud';
import type { Row } from '@/lib/crud/entities';

/** One load per browser session, shared by every component on the page.
 *
 * The cache lives here, on the client, and not next to the server action: a
 * module-level variable in a `use server` module is shared by every user the
 * process serves, which would hand one teacher's scope to the next caller.
 * Served from the browser it is per session — a teacher who is reassigned sees
 * the change after a reload. */
let scopeOnce: Promise<Result<TeachingScope>> | null = null;

function loadScopeOnce(): Promise<Result<TeachingScope>> {
  scopeOnce ??= myTeachingScope();
  return scopeOnce;
}

/** Loads the current teacher's scope. `null` means "not resolved yet".
 *
 * An unresolved scope hides everything rather than showing everything for a
 * moment: the CRUD endpoints hand back every record, so the safe reading of
 * "we do not know what this teacher owns" is "none of it is theirs". A teacher
 * with a `restricted: false` scope (an admin) sees everything as soon as the
 * scope resolves, and `TeachingScope.error` carries the reason when it could
 * not be loaded at all. */
export function useTeacherScope(): TeachingScope | null {
  const [scope, setScope] = useState<TeachingScope | null>(null);
  useEffect(() => {
    let alive = true;
    loadScopeOnce().then((res) => {
      if (!alive) return;
      setScope(
        res.ok
          ? res.data
          : { restricted: true, classIds: [], subjectIds: [], statementIds: [], error: res.error },
      );
    });
    return () => {
      alive = false;
    };
  }, []);
  return scope;
}

/** A class belongs to the teacher when it is one of their assigned classes. */
export function classInScope(scope: TeachingScope | null, row: Row): boolean {
  if (!scope) return false;
  if (!scope.restricted) return true;
  return scope.classIds.includes(Number(row.id));
}

/** A statement belongs to the teacher when its class or subject is assigned. */
export function statementInScope(scope: TeachingScope | null, row: Row): boolean {
  if (!scope) return false;
  if (!scope.restricted) return true;
  return scope.classIds.includes(Number(row.classId)) || scope.subjectIds.includes(Number(row.subjectId));
}

/** A simulation belongs to the teacher when its statement is in scope. */
export function simulationInScope(scope: TeachingScope | null, row: Row): boolean {
  if (!scope) return false;
  if (!scope.restricted) return true;
  const statement = row.statement as Row | null | undefined;
  const id = Number(statement?.id);
  return Number.isFinite(id) && scope.statementIds.includes(id);
}
