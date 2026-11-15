'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import { CONSENT_EVENT, readConsent } from '@/lib/consent';
import { deviceType, pageForPath, track, vitalValue, type VitalMetric } from '@/lib/analytics';
import { BASE_PATH } from '@/lib/base-path';
import { isLocalVitalsHost, type VitalSample } from '@/lib/vitals';

const VITAL_NAMES = new Set(['LCP', 'INP', 'TTFB', 'FCP', 'CLS']);

/**
 * As métricas de campo do aluno (#799). O Next entrega LCP, INP, TTFB, FCP e CLS; o evento
 * `web_vitals` leva a página canónica e o tipo de aparelho, nunca a URL completa nem ids.
 *
 * Sem consentimento não se mede e não se envia: o que chegou fica na memória da página e só
 * sai quando a pessoa aceita (`CONSENT_EVENT`), como o `page_view`. Uma métrica por página e
 * por carregamento, no máximo; o INP/LCP vão sendo atualizados e envia-se o último valor.
 */
export function WebVitalsTracker() {
  const pathname = usePathname();
  const pending = useRef(new Map<string, Omit<VitalSample, 'device'>>());
  const sent = useRef(new Set<string>());

  const flush = useCallback(() => {
    if (readConsent() !== 'all') return;
    const device = deviceType(
      window.innerWidth,
      window.matchMedia?.('(pointer: coarse)').matches ?? false,
      navigator.userAgent,
    );
    const local = isLocalVitalsHost(window.location.hostname);
    for (const [key, sample] of pending.current) {
      if (sent.current.has(key)) continue;
      const status = track('web_vitals', {
        app: 'student', page: sample.page, metric: sample.metric, value: sample.value, device,
      });
      if (status !== 'sent' && status !== 'queued') continue;
      sent.current.add(key);
      if (local) {
        // O painel local (`/aluno/metricas`) só existe com KIXI_VITALS_LOG=true; fora disso, 404 silencioso.
        void fetch(`${BASE_PATH}/api/vitals`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ app: 'student', ...sample, device }),
          keepalive: true,
        }).catch(() => undefined);
      }
    }
    pending.current.clear();
  }, []);

  const report = useCallback((metric: { id: string; name: string; value: number }) => {
    if (!VITAL_NAMES.has(metric.name)) return;
    const name = metric.name as VitalMetric;
    const page = pageForPath('student', window.location.pathname);
    // O `id` do Next é único por métrica e navegação: a mesma página visitada outra vez
    // volta a contar, mas as atualizações de LCP/INP da mesma visita não duplicam.
    pending.current.set(`${page}:${name}:${metric.id}`, { page, metric: name, value: vitalValue(name, metric.value) });
  }, []);

  useReportWebVitals(report);

  // Ao aceitar, ao sair e ao mudar de rota: é quando o último valor de LCP/INP já está fechado.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener(CONSENT_EVENT, flush);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener(CONSENT_EVENT, flush);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [flush]);

  useEffect(() => {
    flush();
    return flush;
  }, [pathname, flush]);

  return null;
}
