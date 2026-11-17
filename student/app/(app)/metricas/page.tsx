import { notFound } from 'next/navigation';
import { VitalsPanel } from '@/components/analytics/vitals-panel';

export const dynamic = 'force-dynamic';

/** Painel local de métricas de campo (#799); desligado fora de `KIXI_VITALS_LOG=true`. */
export default function MetricasPage() {
  if (process.env.KIXI_VITALS_LOG !== 'true') notFound();
  return <VitalsPanel />;
}
