import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger.js';

export const SELECTORS = {
  primaryIframe: [
    '#options-0 iframe',
    '.video.aa-tb.hdd.on iframe',
    'aside.video-player iframe',
    'iframe[src*="as-cdn"]',
    'iframe[data-src*="as-cdn"]',
    'iframe[src*="/video/"]',
    'iframe[data-src*="/video/"]',
  ],
  altIframe: [
    '#options-1 iframe',
    'iframe[src*="multi-lang-plyr"]',
    'iframe[data-src*="multi-lang-plyr"]',
    'iframe[src*="player.php"]',
    'iframe[data-src*="player.php"]',
  ],
  title: ['h1.entry-title', 'h1', 'title'],
};

export interface SeasonRange {
  season: number;
  startEp: number;
  endEp: number;
}

/**
 * Extract primary player iframe URL from AnimeSalt HTML
 */
export function extractPrimaryIframeUrl(html: string): string | null {
  if (!html) return null;
  const $ = cheerio.load(html);

  for (const selector of SELECTORS.primaryIframe) {
    const el = $(selector);
    if (el.length > 0) {
      const src = el.attr('src') || el.attr('data-src');
      if (src && (src.includes('/video/') || src.includes('as-cdn') || src.startsWith('http'))) {
        logger.animesalt(`Found primary iframe with selector "${selector}": ${src}`);
        return src;
      }
    }
  }

  const regexMatch = html.match(
    /https?:\/\/[a-zA-Z0-9.-]*as-cdn[a-zA-Z0-9.-]*\/video\/[a-f0-9]{32}/i
  );
  if (regexMatch) {
    logger.animesalt(`Found iframe via regex fallback: ${regexMatch[0]}`);
    return regexMatch[0];
  }

  return null;
}

/**
 * Extract all player iframe URLs from AnimeSalt HTML
 */
export function extractAllIframeUrls(html: string): string[] {
  if (!html) return [];
  const $ = cheerio.load(html);
  const urls: string[] = [];

  $('iframe').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (src && src.startsWith('http')) {
      urls.push(src);
    }
  });

  return urls;
}

/**
 * Extract page title for metadata hints
 */
export function extractTitleFromPage(html: string): string | null {
  if (!html) return null;
  const $ = cheerio.load(html);
  for (const selector of SELECTORS.title) {
    const text = $(selector).first().text().trim();
    if (text) return text;
  }
  return null;
}

/**
 * Parse season episode ranges from series landing page HTML
 * Example: "Season 8 • 152-175 (24)" -> { season: 8, startEp: 152, endEp: 175 }
 */
export function parseSeasonRanges(seriesHtml: string): Map<number, SeasonRange> {
  const map = new Map<number, SeasonRange>();
  if (!seriesHtml) return map;

  const $ = cheerio.load(seriesHtml);
  $('.season-btn, .sel-temp, .season-buttons a, .season-select option').each((_, el) => {
    const text = $(el).text().trim();
    const match = text.match(/Season\s+(\d+)\s*•\s*(\d+)-(\d+)/i);
    if (match) {
      const season = parseInt(match[1], 10);
      const startEp = parseInt(match[2], 10);
      const endEp = parseInt(match[3], 10);
      map.set(season, { season, startEp, endEp });
    }
  });

  return map;
}
