import { listInvitations } from '@/lib/exam-room';
import { InicioFeed } from './inicio-feed';

/**
 * O início, com as salas de prova do aluno por cima do feed.
 *
 * Os convites leem-se aqui, no servidor, porque `GET /exam-rooms/mine` precisa do
 * cookie da sessão. O resto do feed é estado do cliente. Uma falha a ler as salas
 * não leva o feed com ela: a secção simplesmente não aparece.
 *
 * Trazido do #125 (Cxdy008), sobre a secção do #128.
 */
export default async function InicioPage() {
  return <InicioFeed invitations={await listInvitations()} />;
}
