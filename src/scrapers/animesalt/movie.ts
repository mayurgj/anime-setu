import axios from 'axios';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { globalCache } from '../../utils/cache.js';
import { generateCandidateSlugs, buildMovieUrl } from '../../utils/slug.js';
import { MediaIdentity, StreamCandidate } from '../../streams/types.js';
import { extractPrimaryIframeUrl } from './parser.js';
import { playerResolver } from './player.js';

export class AnimeSaltMovieScraper {
  /**
   * Scrape movie streams from AnimeSalt by MediaIdentity
   */
  async scrape(media: MediaIdentity): Promise<StreamCandidate[]> {
    const titles = [
      media.title,
      media.originalTitle,
      ...(media.alternateTitles || []),
    ].filter(Boolean) as string[];

    const candidateSlugs = generateCandidateSlugs(titles);
    logger.animesalt(`Movie candidate slugs for "${media.title}": ${candidateSlugs.join(', ')}`);

    for (const slug of candidateSlugs) {
      const streams = await this.scrapeBySlug(slug);
      if (streams.length > 0) {
        return streams;
      }
    }

    logger.animesalt(`No AnimeSalt movie page found for: "${media.title}"`);
    return [];
  }

  /**
   * Scrape movie streams given a direct slug
   */
  async scrapeBySlug(slug: string): Promise<StreamCandidate[]> {
    const pageUrl = buildMovieUrl(slug);
    const cacheKey = `animesalt_movie_page:${slug}`;
    const cachedStreams = globalCache.get<StreamCandidate[]>(cacheKey);
    if (cachedStreams) {
      return cachedStreams;
    }

    try {
      logger.animesalt(`Trying movie URL: ${pageUrl}`);
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
        logger.animesalt(`No iframe found on movie page: ${pageUrl}`);
        return [];
      }

      logger.animesalt(`Found player iframe: ${iframeUrl}`);
      const playerResult = await playerResolver.resolve(iframeUrl, pageUrl);
      if (playerResult.streams.length > 0) {
        globalCache.set(cacheKey, playerResult.streams, env.CACHE_TTL_SCRAPER);
        return playerResult.streams;
      }
    } catch (err: any) {
      logger.animesalt(`Failed to fetch movie page ${pageUrl}: ${err.message}`);
    }

    return [];
  }
}

export const movieScraper = new AnimeSaltMovieScraper();
