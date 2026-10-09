'use client';

import { useEffect, useState } from 'react';
import { myTeachingScope, type TeachingScope } from '@/app/actions/crud';
import type { Row } from '@/lib/crud/entities';

/** Loads the current teacher's scope once. Returns `null` while unresolved, in
 * which case the helpers below never hide anything (no premature flash of an
 * empty list). Admins get `{ restricted: false }` and are never filtered. */
export function useTeacherScope(): TeachingScope | null {
  const [scope, setScope] = useState<TeachingScope | null>(null);
  useEffect(() => {
    let alive = true;
    myTeachingScope().then((res) => {
      if (alive && res.ok) setScope(res.data);
    });
    return () => {
      alive = false;
    };
  }, []);
  return scope;
}

/** A class belongs to the teacher when it is one of their assigned classes. */
export function classInScope(scope: TeachingScope | null, row: Row): boolean {
  if (!scope?.restricted) return true;
  return scope.classIds.includes(Number(row.id));
}

/** A statement belongs to the teacher when its class or subject is assigned. */
export function statementInScope(scope: TeachingScope | null, row: Row): boolean {
  if (!scope?.restricted) return true;
  return scope.classIds.includes(Number(row.classId)) || scope.subjectIds.includes(Number(row.subjectId));
}

/** A simulation belongs to the teacher when its statement is in scope. */
export function simulationInScope(scope: TeachingScope | null, row: Row): boolean {
  if (!scope?.restricted) return true;
  const statement = row.statement as Row | null | undefined;
  const id = Number(statement?.id);
  return Number.isFinite(id) && scope.statementIds.includes(id);
}
