import { describe, it, expect } from 'vitest';
import {
  normalizeSlug,
  buildMovieUrl,
  buildSeriesUrl,
  parseSeriesSlug,
  generateCandidateSlugs,
} from '../src/utils/slug.js';

describe('Slug & URL Utilities', () => {
  it('normalizes simple titles correctly', () => {
    expect(normalizeSlug('Naruto: Shippuden')).toBe('naruto-shippuden');
    expect(normalizeSlug('Shinchan Movie: The Spicy Kasukabe Dancers')).toBe(
      'shinchan-movie-the-spicy-kasukabe-dancers'
    );
  });

  it('handles special characters, punctuation, and unicode accents', () => {
    expect(normalizeSlug('Pokémon: The First Movie')).toBe('pokemon-the-first-movie');
    expect(normalizeSlug('Attack on Titan: Final Season - Part 2')).toBe(
      'attack-on-titan-final-season-part-2'
    );
    expect(normalizeSlug('  Multiple   Spaces   -- and dashes  ')).toBe(
      'multiple-spaces-and-dashes'
    );
  });

  it('builds movie URL correctly', () => {
    expect(buildMovieUrl('shinchan-movie-the-spicy-kasukabe-dancers')).toBe(
      'https://animesalt.cx/movies/shinchan-movie-the-spicy-kasukabe-dancers/'
    );
  });

  it('builds series episode URL correctly', () => {
    expect(buildSeriesUrl('naruto-shippuden', 2, 33)).toBe(
      'https://animesalt.cx/episode/naruto-shippuden-2x33/'
    );
    expect(buildSeriesUrl('naruto-shippuden', 3, 54)).toBe(
      'https://animesalt.cx/episode/naruto-shippuden-3x54/'
    );
  });

  it('parses series slug into title, season, and episode (PRD §22)', () => {
    const result1 = parseSeriesSlug('naruto-shippuden-2x33');
    expect(result1).toEqual({
      title: 'naruto-shippuden',
      season: 2,
      episode: 33,
    });

    const result2 = parseSeriesSlug('naruto-shippuden-3x54');
    expect(result2).toEqual({
      title: 'naruto-shippuden',
      season: 3,
      episode: 54,
    });
  });

  it('generates candidate variations for slugs', () => {
    const candidates = generateCandidateSlugs([
      'The Naruto Movie',
      'Naruto Shippuden',
    ]);
    expect(candidates).toContain('the-naruto-movie');
    expect(candidates).toContain('naruto');
    expect(candidates).toContain('naruto-shippuden');
  });
});
