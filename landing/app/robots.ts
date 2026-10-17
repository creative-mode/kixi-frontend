import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/content';

export default function robots(): MetadataRoute.Robots {
  return {
    // O app do aluno está todo atrás de login: só o registo e a entrada interessam a quem pesquisa.
    rules: { userAgent: '*', allow: ['/', '/aluno/cadastro', '/aluno/entrar'], disallow: ['/aluno', '/manager', '/api', '/403'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
