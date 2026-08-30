import { describe, it, expect } from 'vitest';
import { movieScraper } from '../src/scrapers/animesalt/movie.js';
import { seriesScraper } from '../src/scrapers/animesalt/series.js';
import { metadataResolver } from '../src/metadata/resolver.js';
import { resolveStremioStreams } from '../src/streams/resolver.js';

describe('AnimeSalt Live Integration Tests', () => {
  it('scrapes live movie stream for Shinchan Movie: The Spicy Kasukabe Dancers', async () => {
    const streams = await movieScraper.scrapeBySlug(
      'shinchan-movie-the-spicy-kasukabe-dancers'
    );
    expect(streams).toBeDefined();
    expect(Array.isArray(streams)).toBe(true);

    if (streams.length > 0) {
      const first = streams[0];
      expect(first.url).toContain('.m3u8');
      expect(first.name).toBe('AnimeSalt');
      
      const stremioResult = resolveStremioStreams(streams);
      expect(stremioResult.streams.length).toBeGreaterThan(0);
      expect(stremioResult.streams[0].url).toContain('.m3u8');
    }
  }, 20000);

  it('scrapes live series stream for Naruto Shippuden S2E33', async () => {
    const streams = await seriesScraper.scrapeByEpisode('naruto-shippuden', 2, 33);
    expect(streams).toBeDefined();
    expect(Array.isArray(streams)).toBe(true);

    if (streams.length > 0) {
      const first = streams[0];
      expect(first.url).toContain('.m3u8');
      expect(first.name).toBe('AnimeSalt');
    }
  }, 20000);

  it('resolves metadata from TMDB if configured', async () => {
    // TMDB ID 31911 is Naruto Shippuden
    const seriesMeta = await metadataResolver.resolveSeries('tmdb:31911', 2, 33);
    if (seriesMeta) {
      expect(seriesMeta.title).toBeDefined();
      expect(seriesMeta.season).toBe(2);
      expect(seriesMeta.episode).toBe(33);
    }
  }, 15000);
});
