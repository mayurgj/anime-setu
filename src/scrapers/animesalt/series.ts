import axios from 'axios';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { globalCache } from '../../utils/cache.js';
import { generateCandidateSlugs, buildSeriesUrl } from '../../utils/slug.js';
import { MediaIdentity, StreamCandidate } from '../../streams/types.js';
import { extractPrimaryIframeUrl, parseSeasonRanges, SeasonRange } from './parser.js';
import { playerResolver } from './player.js';

export class AnimeSaltSeriesScraper {
  /**
   * Fetch and cache season episode ranges for a series
   */
  async getSeriesSeasonRanges(titleSlug: string): Promise<Map<number, SeasonRange>> {
    const cacheKey = `animesalt_series_seasons:${titleSlug}`;
    const cached = globalCache.get<Map<number, SeasonRange>>(cacheKey);
    if (cached) return cached;

    const seriesUrl = `${env.ANIMESALT_BASE_URL}/series/${titleSlug}/`;
    try {
      logger.animesalt(`Fetching series page for season mapping: ${seriesUrl}`);
      const res = await axios.get(seriesUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          Referer: `${env.ANIMESALT_BASE_URL}/`,
        },
        timeout: 10000,
        validateStatus: (status) => status === 200,
      });

      const seasonMap = parseSeasonRanges(res.data);
      if (seasonMap.size > 0) {
        globalCache.set(cacheKey, seasonMap, env.CACHE_TTL_METADATA);
        return seasonMap;
      }
    } catch (err: any) {
      logger.animesalt(`Could not fetch series landing page ${seriesUrl}: ${err.message}`);
    }

    return new Map();
  }

  /**
   * Scrape series episode streams from AnimeSalt by MediaIdentity
   */
  async scrape(media: MediaIdentity): Promise<StreamCandidate[]> {
    const season = media.season || 1;
    const episode = media.episode || 1;

    const rawTitles = [
      media.title,
      media.originalTitle,
      ...(media.alternateTitles || []),
    ].filter(Boolean) as string[];

    let candidateSlugs = generateCandidateSlugs(rawTitles);

    // Filter out pure numbers if we have meaningful name slugs
    const nonNumeric = candidateSlugs.filter((s) => !/^\d+$/.test(s));
    if (nonNumeric.length > 0) {
      candidateSlugs = nonNumeric;
    }

    logger.animesalt(
      `Series candidate slugs for "${media.title}" S${season}E${episode}: ${candidateSlugs.join(', ')}`
    );

    for (const titleSlug of candidateSlugs) {
      // 1. If season > 1, check season range first for absolute numbering
      if (season > 1) {
        const seasonMap = await this.getSeriesSeasonRanges(titleSlug);
        const seasonRange = seasonMap.get(season);

        if (seasonRange) {
          const absoluteEp = seasonRange.startEp + episode - 1;
          logger.animesalt(
            `Detected absolute episode mapping for ${titleSlug} S${season}E${episode} -> Episode ${absoluteEp}`
          );

          // Try S{season}x{absEpisode} (e.g. naruto-shippuden-8x163)
          const streams = await this.scrapeByEpisode(titleSlug, season, absoluteEp);
          if (streams.length > 0) {
            return streams;
          }
        }
      }

      // 2. Try direct relative S{season}x{episode} (e.g. naruto-shippuden-1x1 or standard relative series)
      const relativeStreams = await this.scrapeByEpisode(titleSlug, season, episode);
      if (relativeStreams.length > 0) {
        return relativeStreams;
      }

      // 3. Fallback: If not tried yet, query series page now to check season mapping
      if (season > 1) {
        const seasonMap = await this.getSeriesSeasonRanges(titleSlug);
        const seasonRange = seasonMap.get(season);
        if (seasonRange) {
          const absoluteEp = seasonRange.startEp + episode - 1;
          const streams = await this.scrapeByEpisode(titleSlug, season, absoluteEp);
          if (streams.length > 0) {
            return streams;
          }
        }
      }
    }

    logger.animesalt(
      `No AnimeSalt episode page found for: "${media.title}" S${season}E${episode}`
    );
    return [];
  }

  /**
   * Scrape series streams given title slug, season, and episode
   */
  async scrapeByEpisode(titleSlug: string, season: number, episode: number): Promise<StreamCandidate[]> {
    const pageUrl = buildSeriesUrl(titleSlug, season, episode);
    const cacheKey = `animesalt_series_page:${titleSlug}-${season}x${episode}`;
    const cachedStreams = globalCache.get<StreamCandidate[]>(cacheKey);
    if (cachedStreams) {
      return cachedStreams;
    }

    try {
      logger.animesalt(`Trying series episode URL: ${pageUrl}`);
      const res = await axios.get(pageUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          Referer: `${env.ANIMESALT_BASE_URL}/`,
        },
        timeout: 10000,
        validateStatus: (status) => status === 200,
      });

      const html = res.data;
      const iframeUrl = extractPrimaryIframeUrl(html);
      if (!iframeUrl) {
        logger.animesalt(`No iframe found on series page: ${pageUrl}`);
        return [];
      }

      logger.animesalt(`Found player iframe: ${iframeUrl}`);
      const playerResult = await playerResolver.resolve(iframeUrl, pageUrl);
      if (playerResult.streams.length > 0) {
        globalCache.set(cacheKey, playerResult.streams, env.CACHE_TTL_SCRAPER);
        return playerResult.streams;
      }
    } catch (err: any) {
      logger.animesalt(`Failed to fetch series page ${pageUrl}: ${err.message}`);
    }

    return [];
  }
}

export const seriesScraper = new AnimeSaltSeriesScraper();
