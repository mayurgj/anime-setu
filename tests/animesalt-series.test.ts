import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { extractPrimaryIframeUrl, extractTitleFromPage } from '../src/scrapers/animesalt/parser.js';

describe('AnimeSalt Series Parser', () => {
  const seriesPageHtml = fs.readFileSync(
    path.resolve(process.cwd(), 'fixtures/animesalt/series-page.html'),
    'utf8'
  );

  it('extracts the primary CDN player iframe from series page', () => {
    const iframeUrl = extractPrimaryIframeUrl(seriesPageHtml);
    expect(iframeUrl).toBe(
      'https://as-cdn26.top/video/05f971b5ec196b8c65b75d2ef8267331'
    );
  });

  it('extracts page title from series page', () => {
    const title = extractTitleFromPage(seriesPageHtml);
    expect(title).toBeTruthy();
  });
});
