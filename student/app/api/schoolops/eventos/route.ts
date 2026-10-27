import { createHmac, timingSafeEqual } from 'node:crypto';
import { assinaturaValida } from '@/lib/schoolops/correcao-rules';

// Receptor do callback do SchoolOps (eventos CloudEvents assinados, Standard Webhooks). A nota chega ao ecrã por leitura
// (GET /v1/correcoes/{id}); este endpoint só confirma a entrega, para o motor não a repetir nem abrir um incidente.
// Recusa o que não vier assinado com SCHOOLOPS_SEGREDO_EVENTOS.

export async function POST(req: Request): Promise<Response> {
  const segredo = process.env.SCHOOLOPS_SEGREDO_EVENTOS;
  if (!segredo) return new Response(null, { status: 404 });
  const corpo = await req.text();
  const ok = assinaturaValida(
    (chave, texto) => createHmac('sha256', chave).update(texto).digest(),
    timingSafeEqual,
    segredo,
    {
      id: req.headers.get('webhook-id'),
      timestamp: req.headers.get('webhook-timestamp'),
      assinatura: req.headers.get('webhook-signature'),
    },
    corpo,
    Date.now() / 1000,
  );
  return new Response(null, { status: ok ? 204 : 401 });
}
