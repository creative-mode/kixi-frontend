import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/content';

export default function robots(): MetadataRoute.Robots {
  return {
    // O app do aluno está todo atrás de login: só o registo e a entrada interessam a quem pesquisa.
    // `/llms.txt` e `/sitemap.xml` são ficheiros para agentes, não páginas de
    // indexar: o allow é inofensivo e deixa-os encontráveis por quem os procura.
    rules: {
      userAgent: '*',
      allow: ['/', '/aluno/cadastro', '/aluno/entrar', '/llms.txt'],
      disallow: ['/aluno', '/manager', '/api', '/403'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
