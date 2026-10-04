'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Plus, ArrowRight, GraduationCap, Shield } from 'lucide-react';
import Link from 'next/link';
import { KixiLogo } from '@/components/kixi-logo';
import { getActiveSchoolYears } from '@/app/actions/school-year';
import { fetchCurrentUser } from '@/lib/auth';
import type { SchoolYearResponse } from '@/types/school-year';

export default function ManagerDashboard() {
  const [schoolYears, setSchoolYears] = useState<SchoolYearResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [years, user] = await Promise.all([
          getActiveSchoolYears().catch(() => []),
          fetchCurrentUser(),
        ]);
        setSchoolYears(years);
        if (user) setUserRoles(user.roles);
      } catch {
        // Silently handle errors
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-pixel text-2xl leading-tight text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo ao painel de gestão do Kixi.
          </p>
        </div>
        <KixiLogo size={48} className="hidden md:inline-flex" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Anos Letivos</CardTitle>
            <div className="h-9 w-9 rounded-[4px] border-2 border-current/40 bg-tiro-tint text-tiro-ink flex items-center justify-center">
              <Calendar className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-pixel text-2xl leading-tight text-foreground">
              {loading ? '—' : schoolYears.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ativos no sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Seu Perfil</CardTitle>
            <div className="h-9 w-9 rounded-[4px] border-2 border-current/40 bg-radar-tint text-radar-ink flex items-center justify-center">
              <Shield className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-pixel text-2xl leading-tight text-foreground capitalize">
              {userRoles[0]?.toLowerCase() || '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {userRoles.length > 1 ? `+ ${userRoles.length - 1} outros roles` : 'role principal'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ações Rápidas</CardTitle>
            <div className="h-9 w-9 rounded-[4px] border-2 border-current/40 bg-pop-tint text-pop-ink flex items-center justify-center">
              <GraduationCap className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild size="sm" className="w-full justify-start ">
              <Link href="/school-year/new">
                <Plus size={14} className="mr-2 text-white" />
                Novo Ano Letivo
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full justify-start border-border text-foreground hover:bg-accent">
              <Link href="/school-year">
                <ArrowRight size={14} className="mr-2" />
                Ver Anos Letivos
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent School Years */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Anos Letivos Recentes</CardTitle>
          <Button asChild variant="ghost" size="sm" className="text-foreground hover:text-foreground hover:bg-accent">
            <Link href="/school-year">
              Ver todos <ArrowRight size={14} className="ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : schoolYears.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-12 w-12 rounded-[4px] border-2 border-border bg-accent flex items-center justify-center mx-auto mb-4">
                <Calendar size={24} className="text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">Nenhum ano letivo registado ainda.</p>
              <Button asChild className="">
                <Link href="/school-year/new">
                  <Plus size={16} className="mr-2" />
                  Criar Primeiro Ano Letivo
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {schoolYears.slice(0, 5).map((year) => (
                <Link
                  key={year.id}
                  href={`/school-year/${year.id}`}
                  className="flex items-center justify-between p-4 rounded-[4px] border-2 border-border hover:border-primary hover:bg-accent transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-[4px] border-2 border-current/40 bg-brand-tint text-phosphor flex items-center justify-center group-hover:bg-accent transition-colors">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {year.startYear} – {year.endYear}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Ano letivo
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
