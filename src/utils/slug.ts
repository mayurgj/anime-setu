import { env } from '../config/env.js';

/**
 * Robust slug generation matching AnimeSalt conventions.
 */
export function normalizeSlug(title: string): string {
  if (!title) return '';

  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`"]/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate candidate slugs for searching AnimeSalt
 */
export function generateCandidateSlugs(titles: (string | undefined | null)[]): string[] {
  const candidates = new Set<string>();

  for (const raw of titles) {
    if (!raw) continue;

    const base = normalizeSlug(raw);
    if (!base) continue;

    candidates.add(base);

    // Variation 1: without leading 'the-'
    if (base.startsWith('the-')) {
      const withoutThe = base.slice(4);
      candidates.add(withoutThe);
      if (withoutThe.includes('-movie')) {
        candidates.add(withoutThe.replace(/-the-movie|-movie/g, ''));
      }
    }

    // Variation 2: without '-the-movie' or '-movie'
    if (base.includes('-the-movie')) {
      candidates.add(base.replace(/-the-movie/g, ''));
    }
    if (base.includes('-movie')) {
      candidates.add(base.replace(/-movie/g, ''));
    }
  }

  return Array.from(candidates);
}

/**
 * Build AnimeSalt movie URL
 */
export function buildMovieUrl(slug: string): string {
  const cleanSlug = slug.replace(/^\/+|\/+$/g, '');
  return `${env.ANIMESALT_BASE_URL}/movies/${cleanSlug}/`;
}

/**
 * Build AnimeSalt episode URL
 */
export function buildSeriesUrl(titleSlug: string, season: number, episode: number): string {
  const cleanSlug = titleSlug.replace(/^\/+|\/+$/g, '');
  return `${env.ANIMESALT_BASE_URL}/episode/${cleanSlug}-${season}x${episode}/`;
}

/**
 * Parse a series episode slug into title, season, and episode.
 * Example: 'naruto-shippuden-2x33' -> { title: 'naruto-shippuden', season: 2, episode: 33 }
 */
export function parseSeriesSlug(slug: string): { title: string; season: number; episode: number } | null {
  if (!slug) return null;
  
  const clean = slug.replace(/^\/+|\/+$/g, '');
  const match = clean.match(/^(.*?)-(\d+)x(\d+)$/i);
  if (!match) return null;

  return {
    title: match[1],
    season: parseInt(match[2], 10),
    episode: parseInt(match[3], 10),
  };
}
