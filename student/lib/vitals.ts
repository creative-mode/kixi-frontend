/**
 * As métricas de campo do aluno (#799), sem React e sem browser: o que o `WebVitalsTracker`
 * envia e o que o painel local agrega. O contrato do evento vive em `analytics.ts` (igual nas
 * três apps); aqui fica só a matemática e os limiares.
 */
import type { VitalDevice, VitalMetric } from './analytics.ts';

/** Um `web_vitals` já aceite pelo contrato: sem ids, sem URL completa, só a página canónica. */
export interface VitalSample {
  page: string;
  metric: VitalMetric;
  /** CLS é adimensional; as restantes são milissegundos. */
  value: number;
  device: VitalDevice;
}

export interface VitalSummary {
  page: string;
  metric: VitalMetric;
  device: VitalDevice;
  samples: number;
  p75: number;
  /** O p75 cabe na meta da métrica (web.dev «good»). */
  good: boolean;
}

/** Metas de campo: INP e LCP são as da issue; as outras são as «good» do web.dev. */
export const VITAL_TARGETS: Record<VitalMetric, number> = {
  LCP: 2500,
  INP: 200,
  TTFB: 800,
  FCP: 1800,
  CLS: 0.1,
};

/** p75 pelo mesmo método do orçamento de laboratório (`e2e/desempenho.spec.ts`). */
export function p75(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.ceil(ordered.length * 0.75) - 1];
}

export function summarizeVitals(samples: readonly VitalSample[]): VitalSummary[] {
  const groups = new Map<string, VitalSample[]>();
  for (const sample of samples) {
    const key = `${sample.page}|${sample.metric}|${sample.device}`;
    groups.set(key, [...(groups.get(key) ?? []), sample]);
  }
  return [...groups.values()]
    .map((group) => {
      const { page, metric, device } = group[0];
      const value = p75(group.map((sample) => sample.value));
      return { page, metric, device, samples: group.length, p75: value, good: value <= VITAL_TARGETS[metric] };
    })
    .sort((a, b) => a.page.localeCompare(b.page) || a.metric.localeCompare(b.metric) || a.device.localeCompare(b.device));
}

/**
 * O painel local só faz sentido na máquina de quem testa: `localhost`, `127.x` e as redes
 * privadas (o telemóvel na mesma Wi-Fi). Em produção o evento vai só para o GA4.
 */
export function isLocalVitalsHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '::1' || host.endsWith('.localhost')) return true;
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  return /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}
