import { getCurrentUser } from '@/lib/auth.server';
import { call, message } from '@/lib/crud/http';

// O ficheiro de uma doação para o administrador o ver. O browser não fala com o backend (o token
// está num cookie httpOnly deste domínio), por isso esta rota junta o cabeçalho e devolve os bytes.
// O tipo é o que o backend reconheceu pelos bytes; `nosniff` e `attachment` mantêm-se: o ficheiro
// é de um desconhecido, vê-se e nunca corre.

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes('ADMIN')) return new Response('Sem permissão.', { status: 401 });
  const { id, fileId } = await params;
  if (!/^\d{1,12}$/.test(id) || !/^\d{1,12}$/.test(fileId)) return new Response('Pedido inválido.', { status: 400 });

  const upstream = await call(`/api/v1/donations/${id}/files/${fileId}`);
  if (!upstream.ok) return new Response(await message(upstream), { status: upstream.status || 502 });
  const headers = new Headers({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
  for (const name of ['content-type', 'content-disposition']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: 200, headers });
}
