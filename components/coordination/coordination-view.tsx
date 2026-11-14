'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { coordinationRooms } from '@/app/actions/coordination';
import { ACTION_TIMEOUT_MS, withDeadline } from '@/lib/timeout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionState } from '@/components/dashboard/section-state';
import { FilterTabs, filterPanelProps } from '@/components/crud/filter-tabs';
import { Pagination } from '@/components/crud/pagination';
import { useQueryChoice, useQueryPage } from '@/hooks/use-query-state';
import { paginate } from '@/lib/queue-state';
import {
  DEFAULT_ROOM_FILTER,
  filterRooms,
  roomCounts,
  roomPhaseLabel,
  roomProgress,
  roomsByUrgency,
  ROOM_FILTERS,
  type RoomFilter,
} from '@/lib/coordination';
import { PHASE_VARIANT, roomPhase } from '@/lib/exam-rooms/model';
import { formatDate } from '@/lib/term-plans';
import type { Section } from '@/types/analytics';
import type { CoordinationRoom } from '@/types/coordination';

const FILTER_KEYS = ROOM_FILTERS.map((f) => f.key);
const PAGE_SIZE = 8;

/** As salas de prova da instituição, só para acompanhar (o coordenador não fecha salas nem corrige: é do professor dono da sala). */
export function CoordinationView() {
  const [rooms, setRooms] = useState<Section<CoordinationRoom[]> | null>(null);
  // O filtro e a página vivem no endereço: sobrevivem ao recarregamento e podem ir numa ligação.
  const [filter, setFilter] = useQueryChoice<RoomFilter>('filtro', FILTER_KEYS, DEFAULT_ROOM_FILTER);
  const [page, setPage] = useQueryPage();

  const load = useCallback(async () => {
    try {
      const r = await withDeadline(coordinationRooms(), ACTION_TIMEOUT_MS);
      setRooms(r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error });
    } catch {
      setRooms({ ok: false, error: 'Não foi possível contactar o servidor. Tente novamente.' });
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const counts = useMemo(() => (rooms?.ok ? roomCounts(rooms.data) : null), [rooms]);

  const pick = (next: RoomFilter) => {
    setFilter(next);
    setPage(1);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-7">
      <header>
        <h1 className="text-[26px] font-extrabold tracking-tight">Salas da instituição</h1>
        <p className="text-sm text-muted-foreground">Acompanhe as provas em curso e as notas por aluno. Só leitura: quem fecha e corrige é o professor.</p>
      </header>
      <FilterTabs
        group="coordenacao"
        label="Filtrar por estado"
        value={filter}
        onChange={pick}
        tabs={ROOM_FILTERS.map((f) => ({ key: f.key, label: f.label, count: counts ? counts[f.key] : null }))}
      />
      <div {...filterPanelProps('coordenacao', filter)}>
        <SectionState
          section={rooms}
          onRetry={() => void load()}
          isEmpty={(d) => filterRooms(d, filter).length === 0}
          empty={<p className="text-sm text-muted-foreground">{filter === 'todas' ? 'Ainda não há salas na sua instituição.' : 'Não há salas neste filtro.'}</p>}
        >
          {(data) => {
            const paged = paginate(roomsByUrgency(filterRooms(data, filter)), page, PAGE_SIZE);
            return (
              <>
                <ul className="flex flex-col gap-3">
                  {paged.items.map((room) => (
                    <li key={room.id}>
                      <Card>
                        <CardHeader>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <CardTitle>{room.statementTitle}</CardTitle>
                            <Badge variant={room.pendingAnswers > 0 ? 'destructive' : PHASE_VARIANT[roomPhase(room)]}>{roomPhaseLabel(room)}</Badge>
                          </div>
                          <CardDescription>
                            {room.className} · {room.teacherName ?? '—'} · {formatDate(room.startsAt)} a {formatDate(room.endsAt)}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm">{roomProgress(room)}</p>
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/coordenacao/${room.id}`}>
                              Ver detalhe<span className="sr-only"> da sala {room.statementTitle}</span> <ArrowRight size={14} aria-hidden />
                            </Link>
                          </Button>
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
                <Pagination paged={paged} noun="salas" onPage={setPage} />
              </>
            );
          }}
        </SectionState>
      </div>
    </div>
  );
}
