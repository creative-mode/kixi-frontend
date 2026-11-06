'use client';

import { useCallback, useState } from 'react';
import { Ico } from '@/components/ui/ico';
import { UserAvatar } from '@/components/user-avatar';
import { CountUp } from '@/components/count-up';
import { Experience } from '@/components/experience';
import type { ExperienceEntry } from '@/lib/experience-rules';
import { sairAction } from '@/lib/auth-actions';
import { PostCard } from '@/components/post-card';
import { VisibilityPicker } from '@/components/visibility-picker';
import type { Visibility } from '@/lib/profiles';
import { ProfileEditor } from '@/components/profile-editor';
import { EmptyState } from '@/components/states';
import Link from 'next/link';
import { RefreshError } from '@/components/refresh-error';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { contextLine, fullName, photoUrl } from '@/lib/profile';
import { setReduceMotion, useReduceMotion } from '@/lib/motion';
import { formatAverage } from '@/lib/ranking-rules';
import { shortTitle, type ProfileTab } from '@/lib/social-rules';
import type { Performance } from '@/lib/performance-rules';
import type { CatalogItem } from '@/lib/catalog';
import type { FeedPost } from '@/lib/feed';
import type { Badge, Stats } from '@/lib/stats';
import type { Me } from '@/lib/types';

/** O centro do perfil: cabeçalho, últimas simulações, sequência de estudo e separadores. */
export function PerfilView({
  landingOrigin,
  me,
  stats,
  badges,
  history,
  performance,
  classId,
  posts,
  feedError,
  initialTab = 'Publicações',
  startEditing = false,
  visibility = 'school',
  experience = [],
}: {
  landingOrigin: string | null;
  experience?: ExperienceEntry[];
  me: Me;
  visibility?: Visibility;
  stats: Stats | null;
  badges: Badge[];
  history: CatalogItem[];
  performance: Performance;
  classId: number | null;
  /** As publicações da própria conta, da turma onde está matriculado. */
  posts: FeedPost[];
  feedError?: string | null;
  initialTab?: ProfileTab;
  startEditing?: boolean;
}) {
  const [editing, setEditing] = useState(startEditing);
  const [tab, setTab] = useState<ProfileTab>(initialTab === 'Experiência' ? 'Conquistas' : initialTab);
  const reduceMotion = useReduceMotion();
  const close = useCallback(() => setEditing(false), []);

  const name = fullName(me) || 'Aluno';
  const context = contextLine(me);
  const recent = performance.activity.slice(0, 3);

  const lbl = 'm-0 mb-3 text-[13px] font-bold tracking-[.04em] text-[#617066] uppercase';
  const mut = 'text-sm text-[#617066]';
  const tabs: ProfileTab[] = ['Publicações', 'Conquistas', 'Definições'];

  return (
    <div className="flex w-full flex-col items-center pb-28 md:max-w-[480px] md:self-center md:pb-12 mx-auto">
      <div aria-hidden className="h-[148px] w-full rounded-b-[24px] bg-[#dbe9d3]" />
      <div className="relative -mt-[58px]">
        <span className="block rounded-full border-4 border-white shadow-[0_1px_3px_rgba(18,28,21,.12)]"><UserAvatar name={name} src={photoUrl(me)} size={100} /></span>
        <button type="button" aria-label="Editar perfil" onClick={() => setEditing(true)} className="absolute -right-1 -bottom-1 flex size-9 items-center justify-center rounded-full border-[3px] border-white bg-[#1f5a2c] text-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
        </button>
      </div>
      <h1 className="m-0 mt-3.5 text-[26px] leading-tight font-extrabold tracking-[-0.02em]">{name}</h1>
      <span className={`${mut} mt-1`}>{context || 'Sem afiliação académica: matricula-te para veres o teu feed.'}</span>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {stats && <span className="inline-flex h-8 items-center rounded-full bg-[#f1f6ee] px-3.5 text-sm font-bold text-[#1f5a2c]">Nível {stats.level}</span>}
        {stats && stats.streak > 0 && <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e3e6e0] px-3.5 text-sm font-bold whitespace-nowrap text-[#3d4a41]"><Ico name="flame" filled size={14} className="text-[#c2383e]" />{stats.streak} {stats.streak === 1 ? 'dia seguido' : 'dias seguidos'}</span>}
        {stats && <span className="inline-flex h-8 items-center rounded-full border border-[#e3e6e0] px-3.5 text-sm font-bold whitespace-nowrap text-[#3d4a41]"><CountUp value={String(stats.xp)} />&nbsp;XP</span>}
      </div>

      {editing && <div className="mt-6 w-full px-4 md:px-0"><ProfileEditor me={me} onDone={close} /></div>}

      {recent.length > 0 && (
        <section className="mt-7 w-full px-4 md:px-0">
          <h2 className={lbl}>Últimas simulações</h2>
          <ul aria-label="Últimas simulações" className="m-0 grid list-none grid-cols-3 gap-2.5 p-0">
            {recent.map((a) => (
              <li key={a.id} className="min-w-0">
                <Link prefetch={false} href={`/resultado?prova=${a.id}`} className="flex h-full flex-col gap-1.5 rounded-[14px] bg-[#f5f6f4] px-3.5 py-4 text-[#121c15] no-underline">
                  <strong className="text-xl leading-none tabular-nums">{formatAverage(a.score)}</strong>
                  <span className={`${mut} line-clamp-2`}>{shortTitle(a.title, 32)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div role="tablist" aria-label="Perfil" className="mt-[30px] flex w-[calc(100%-32px)] gap-0.5 rounded-full bg-[#f5f6f4] p-1 md:w-full">
        {tabs.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} aria-pressed={tab === t} onClick={() => setTab(t)} className={`h-10 flex-1 rounded-full border-0 text-[15px] font-bold ${tab === t ? 'bg-[#1f5a2c] text-white' : 'bg-transparent text-[#617066]'}`}>{t}</button>
        ))}
      </div>

      <div className="mt-6 w-full px-4 md:px-0">
        {tab === 'Publicações' && (
          <section aria-label="Publicações" className="flex flex-col">
            {feedError ? (
              <RefreshError title="Não foi possível carregar as publicações" message={feedError} />
            ) : !classId ? (
              <EmptyState title="Matricula-te para publicares" message="As publicações da tua turma aparecem aqui depois da matrícula." />
            ) : posts.length === 0 ? (
              <EmptyState title="Ainda não publicaste nada" message="Partilha uma dúvida ou um tema com a turma e fica aqui." />
            ) : (
              posts.map((p) => <PostCard key={p.id} post={p} myAccountId={me.accountId} myName={name} myPhoto={me.photo} />)
            )}
            {classId && <Link href="/publicar" className="mt-3 flex h-11 items-center justify-center rounded-xl bg-[#1f5a2c] text-[15px] font-bold text-white no-underline">Nova publicação</Link>}
          </section>
        )}

        {tab === 'Conquistas' && (
          <section aria-label="Conquistas">
            <h2 className={lbl}>Medalhas</h2>
            {badges.length === 0 ? (
              <p className={mut}>Termina a primeira simulação para ganhar a primeira medalha.</p>
            ) : badges.map((b, i) => (
              <div key={b.code} className="flex items-center gap-3.5 border-[#eef0ec] py-3.5" style={{ borderTopWidth: i === 0 ? 0 : 1 }}>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#eef6ea] text-[#1f5a2c]"><Ico name="award" filled size={20} /></span>
                <div><strong className="block text-[15px]">{b.name}</strong><span className={mut}>{b.description}</span></div>
              </div>
            ))}

            <h2 className={`${lbl} mt-6`}>Domínio por disciplina</h2>
            {performance.mastery.length === 0 ? (
              <p className={mut}>Entrega uma prova para veres aqui o teu domínio.</p>
            ) : (
              <div className="flex flex-col gap-3.5">
                {performance.mastery.map((t) => (
                  <div key={t.id}>
                    <div className="mb-1.5 flex justify-between text-sm"><span>{t.label}</span><span className="text-[#617066]">{Math.round(t.value)}%</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#eef0ec]"><span className="block h-full rounded-full bg-[#1f5a2c]" style={{ width: `${Math.min(100, Math.max(0, t.value))}%` }} /></div>
                  </div>
                ))}
              </div>
            )}

            <h2 className={`${lbl} mt-6`}>Histórico</h2>
            {history.length === 0 ? (
              <p className={mut}>Ainda não terminaste nenhuma prova. As provas concluídas aparecem aqui, com a nota.</p>
            ) : history.map((item, i) => (
              <div key={item.id} className="flex items-center justify-between gap-3 border-[#eef0ec] py-3.5" style={{ borderTopWidth: i === 0 ? 0 : 1 }}>
                <div><strong className="block text-[15px]">{item.kind} · {item.title}</strong><span className={mut}>{[item.subject, item.school].filter(Boolean).join(' · ')}</span></div>
                <span className="inline-flex h-7 items-center rounded-full bg-[#eef6ea] px-3 text-[13px] font-bold text-[#1f5a2c] tabular-nums">{item.score}</span>
              </div>
            ))}
            <Experience entries={experience} teacher={false} own />
          </section>
        )}

        {tab === 'Definições' && (
          <section aria-label="Definições">
            <h2 className={lbl}>Definições</h2>
            <div className="flex items-center justify-between gap-4 py-3.5">
              <Label htmlFor="def-motion" className="grid cursor-pointer gap-0.5 leading-snug"><span className="text-base">Reduzir movimento</span><span className={`${mut} font-normal`}>Menos animações na interface.</span></Label>
              <Switch id="def-motion" checked={reduceMotion} onCheckedChange={setReduceMotion} />
            </div>
            {/* Issue #107: o tempo extra é uma decisão da escola, não uma preferência de interface: é estado, não interruptor. */}
            <div className="flex items-center justify-between gap-4 border-t border-[#eef0ec] py-3.5">
              <div className="grid gap-0.5 leading-snug"><span className="text-base">+25% de tempo nas provas</span><span className={mut}>Definido pela escola, não por ti.</span></div>
              <span className="inline-flex h-7 items-center rounded-full bg-[#eef6ea] px-3 text-[13px] font-bold text-[#1f5a2c]">{me.accessibility_extra_time ? 'Ativo' : 'Inativo'}</span>
            </div>
            <VisibilityPicker initial={visibility} />
            <Link href="/pautas" className="flex min-h-[58px] items-center gap-3 border-t border-[#eef0ec] text-base text-[#121c15] no-underline hover:text-[#1f5a2c]"><span className="flex-1">As minhas pautas</span><Ico name="chevron" size={18} className="text-[#7a857d]" aria-hidden /></Link>
            <a href={`${landingOrigin ?? ''}/privacidade`} className="flex min-h-[58px] items-center border-t border-[#eef0ec] text-base text-[#121c15] no-underline hover:text-[#1f5a2c]">Privacidade</a>
            <a href={`${landingOrigin ?? ''}/cookies`} className="flex min-h-[58px] items-center border-t border-[#eef0ec] text-base text-[#121c15] no-underline hover:text-[#1f5a2c]">Cookies</a>
            <form action={sairAction} className="border-t border-[#eef0ec] pt-3.5">
              <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-[#dde3da] bg-white text-[15px] font-bold text-[#c2383e]"><Ico name="logout" size={20} />Terminar sessão</button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
