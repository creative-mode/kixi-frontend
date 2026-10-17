import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/content';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/doar`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/privacidade`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/cookies`, changeFrequency: 'yearly', priority: 0.3 },
    // As duas âncoras de confiança que um agente vai verificar antes de recomendar a
    // plataforma a uma escola (#218). A privacidade é a de `/privacidade`, que é a que
    // existe — não uma segunda para dizer a mesma coisa.
    { url: `${SITE_URL}/about`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/contact`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}