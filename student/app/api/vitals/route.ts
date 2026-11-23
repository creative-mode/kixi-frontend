import { sanitizeEvent, type AnalyticsParams, type VitalDevice, type VitalMetric } from '@/lib/analytics';
import { isLocalVitalsHost, summarizeVitals, VITAL_TARGETS, type VitalSample } from '@/lib/vitals';

export const dynamic = 'force-dynamic';

/**
 * Coletor local de métricas de campo (#799). Desligado por omissão: só responde com
 * `KIXI_VITALS_LOG=true` e num host local/rede privada. Não escreve em disco, não guarda
 * ids nem URLs — só página canónica, métrica, valor e tipo de aparelho, em memória.
 */
const MAX_SAMPLES = 5000;
let samples: VitalSample[] = [];

function enabled(request: Request): boolean {
  if (process.env.KIXI_VITALS_LOG !== 'true') return false;
  const host = (request.headers.get('host') ?? '').replace(/:\d+$/, '').toLowerCase();
  return isLocalVitalsHost(host);
}

export async function POST(request: Request) {
  if (!enabled(request)) return new Response(null, { status: 404 });
  if (Number(request.headers.get('content-length') ?? 0) > 2048) return new Response(null, { status: 413 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || body.app !== 'student') return new Response(null, { status: 400 });
  const sanitized = sanitizeEvent('web_vitals', body as AnalyticsParams);
  if (!sanitized) return new Response(null, { status: 400 });
  const params = sanitized.params;
  samples.push({
    page: String(params.page),
    metric: params.metric as VitalMetric,
    value: Number(params.value),
    device: params.device as VitalDevice,
  });
  if (samples.length > MAX_SAMPLES) samples = samples.slice(-MAX_SAMPLES);
  return new Response(null, { status: 204 });
}

export function GET(request: Request) {
  if (!enabled(request)) return new Response(null, { status: 404 });
  return Response.json({ samples: samples.length, targets: VITAL_TARGETS, summary: summarizeVitals(samples) });
}
