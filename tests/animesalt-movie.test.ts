import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { extractPrimaryIframeUrl, extractTitleFromPage } from '../src/scrapers/animesalt/parser.js';

describe('AnimeSalt Movie Parser', () => {
  const moviePageHtml = fs.readFileSync(
    path.resolve(process.cwd(), 'fixtures/animesalt/movie-page.html'),
    'utf8'
  );

  it('extracts the primary CDN player iframe from movie page', () => {
    const iframeUrl = extractPrimaryIframeUrl(moviePageHtml);
    expect(iframeUrl).toBe(
      'https://as-cdn26.top/video/860e6390db45d650def1b4fa0c7dd667'
    );
  });

  it('extracts page title from movie page', () => {
    const title = extractTitleFromPage(moviePageHtml);
    expect(title).toContain('Shinchan Movie: The Spicy Kasukabe Dancers');
  });
});
