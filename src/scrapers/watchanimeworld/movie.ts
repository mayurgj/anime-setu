import axios from 'axios';
import * as cheerio from 'cheerio';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { globalCache } from '../../utils/cache.js';
import { StreamCandidate } from '../../streams/types.js';
import { generateCandidateSlugs } from '../../utils/slug.js';
import { zephyrixPlayerResolver } from './player.js';

export class WatchAnimeWorldMovieScraper {
  private baseUrl = env.WATCHANIMEWORLD_BASE_URL;

  generateCandidateSlugs(title: string): string[] {
    return generateCandidateSlugs([title]);
  }

  async scrapeMovie(options: { slug?: string; title?: string }): Promise<StreamCandidate[]> {
    const candidateSlugs = options.slug
      ? [options.slug]
      : options.title
      ? this.generateCandidateSlugs(options.title)
      : [];

    if (candidateSlugs.length === 0) {
      return [];
    }

    logger.animesalt(`[AnimeWorld] Movie candidate slugs for "${options.title || options.slug}": ${candidateSlugs.join(', ')}`);

    for (const slug of candidateSlugs) {
      const movieUrl = `${this.baseUrl}/movies/${slug}/`;
      const cacheKey = `waw_movie_page:${slug}`;
      const cachedPlayerUrl = globalCache.get<string>(cacheKey);

      if (cachedPlayerUrl) {
        logger.animesalt(`[AnimeWorld] Cache hit player iframe for: ${movieUrl}`);
        const playerResult = await zephyrixPlayerResolver.resolve(cachedPlayerUrl, movieUrl);
        if (playerResult.streams.length > 0) {
          return playerResult.streams;
        }
      }

      try {
        logger.animesalt(`[AnimeWorld] Trying movie URL: ${movieUrl}`);
        const res = await axios.get(movieUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            Referer: `${this.baseUrl}/movies/`,
          },
          timeout: 7000,
        });

        const $ = cheerio.load(res.data);
        let playerUrl =
          $('#options-0 iframe').attr('src') ||
          $('#options-0 iframe').attr('data-src') ||
          $('div.video iframe').attr('src') ||
          $('div.video iframe').attr('data-src') ||
          $('iframe[src*="play.zephyrix.org"]').attr('src') ||
          $('iframe[data-src*="play.zephyrix.org"]').attr('data-src') ||
          $('iframe[src*="/video/"]').attr('src');

        if (!playerUrl) {
          $('iframe').each((_, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src') || '';
            if (src.includes('/video/') || src.includes('zephyrix') || src.includes('player')) {
              playerUrl = src;
              return false;
            }
          });
        }

        if (playerUrl) {
          logger.animesalt(`[AnimeWorld] Found player iframe: ${playerUrl}`);
          globalCache.set(cacheKey, playerUrl, env.CACHE_TTL_SCRAPER);
          const playerResult = await zephyrixPlayerResolver.resolve(playerUrl, movieUrl);
          if (playerResult.streams.length > 0) {
            return playerResult.streams;
          }
        }
      } catch {
        // Continue to next candidate
      }
    }

    return [];
  }
}

export const watchAnimeWorldMovieScraper = new WatchAnimeWorldMovieScraper();
