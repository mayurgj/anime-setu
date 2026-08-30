import { describe, it, expect } from 'vitest';
import axios from 'axios';
import { isAllowedDomain } from '../src/utils/http.js';
import { seriesScraper } from '../src/scrapers/animesalt/series.js';

describe('API & Proxy Unit Tests', () => {
  it('validates allowed domains correctly to prevent SSRF', () => {
    expect(isAllowedDomain('https://animesalt.cx/movies/shinchan/')).toBe(true);
    expect(isAllowedDomain('https://as-cdn26.top/cdn/hls/master.m3u8')).toBe(true);
    expect(isAllowedDomain('https://as-cdn29.top/p/16.jpg')).toBe(true);
    expect(isAllowedDomain('https://evil-site.com/malicious.m3u8')).toBe(false);
    expect(isAllowedDomain('http://169.254.169.254/latest/meta-data/')).toBe(false);
  });

  it('scrapes series episode using dynamic season range mapping', async () => {
    // S8E12 should resolve to episode 163 for Naruto Shippuden
    const seasonMap = await seriesScraper.getSeriesSeasonRanges('naruto-shippuden');
    expect(seasonMap.has(8)).toBe(true);

    const s8 = seasonMap.get(8)!;
    expect(s8.startEp).toBe(152);
    expect(s8.startEp + 12 - 1).toBe(163);

    const streams = await seriesScraper.scrapeByEpisode('naruto-shippuden', 8, 163);
    expect(streams.length).toBeGreaterThan(0);
    expect(streams[0].url).toContain('.m3u8');
  }, 20000);
});
