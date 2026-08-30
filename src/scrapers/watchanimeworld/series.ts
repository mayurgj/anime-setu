import axios from 'axios';
import * as cheerio from 'cheerio';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { globalCache } from '../../utils/cache.js';
import { StreamCandidate } from '../../streams/types.js';
import { generateCandidateSlugs } from '../../utils/slug.js';
import { zephyrixPlayerResolver } from './player.js';

export interface WatchAnimeWorldSeasonRange {
  seasonNumber: number;
  startEp: number;
  endEp: number;
  totalEps: number;
}

export class WatchAnimeWorldSeriesScraper {
  private baseUrl = env.WATCHANIMEWORLD_BASE_URL;

  generateCandidateSlugs(title: string): string[] {
    return generateCandidateSlugs([title]);
  }

  async fetchSeriesSeasonMapping(slug: string): Promise<WatchAnimeWorldSeasonRange[]> {
    const cacheKey = `waw_series_seasons:${slug}`;
    const cached = globalCache.get<WatchAnimeWorldSeasonRange[]>(cacheKey);
    if (cached) return cached;

    const seriesUrl = `${this.baseUrl}/series/${slug}/`;
    try {
      logger.animesalt(`[AnimeWorld] Fetching series page for season mapping: ${seriesUrl}`);
      const res = await axios.get(seriesUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        },
        timeout: 8000,
      });

      const $ = cheerio.load(res.data);
      const episodeLinks: { season: number; episode: number }[] = [];

      $('a[href*="/episode/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const match = href.match(/\/episode\/[^/]+-(\d+)x(\d+)\/?/i);
        if (match) {
          episodeLinks.push({
            season: parseInt(match[1], 10),
            episode: parseInt(match[2], 10),
          });
        }
      });

      const ranges: WatchAnimeWorldSeasonRange[] = [];
      const seasonMap = new Map<number, number[]>();
      for (const ep of episodeLinks) {
        if (!seasonMap.has(ep.season)) seasonMap.set(ep.season, []);
        seasonMap.get(ep.season)!.push(ep.episode);
      }

      for (const [seasonNum, eps] of seasonMap.entries()) {
        eps.sort((a, b) => a - b);
        ranges.push({
          seasonNumber: seasonNum,
          startEp: eps[0],
          endEp: eps[eps.length - 1],
          totalEps: eps.length,
        });
      }

      globalCache.set(cacheKey, ranges, 3600);
      return ranges;
    } catch {
      return [];
    }
  }

  calculateAbsoluteEpisode(
    ranges: WatchAnimeWorldSeasonRange[],
    targetSeason: number,
    targetEpisode: number
  ): { season: number; episode: number } {
    const directSeason = ranges.find((r) => r.seasonNumber === targetSeason);
    if (directSeason) {
      if (targetEpisode >= directSeason.startEp && targetEpisode <= directSeason.endEp) {
        return { season: targetSeason, episode: targetEpisode };
      }
      if (targetEpisode <= directSeason.totalEps) {
        const absEp = directSeason.startEp + targetEpisode - 1;
        return { season: targetSeason, episode: absEp };
      }
    }

    let accumulated = 0;
    for (const r of ranges) {
      if (r.seasonNumber < targetSeason) {
        accumulated += r.totalEps;
      } else if (r.seasonNumber === targetSeason) {
        const calculated = accumulated + targetEpisode;
        return { season: targetSeason, episode: calculated };
      }
    }

    return { season: targetSeason, episode: targetEpisode };
  }

  async scrapeSeriesEpisode(options: {
    slug?: string;
    season: number;
    episode: number;
    title?: string;
  }): Promise<StreamCandidate[]> {
    const { season, episode, title } = options;
    const candidateSlugs = options.slug
      ? [options.slug]
      : title
      ? this.generateCandidateSlugs(title)
      : [];

    if (candidateSlugs.length === 0) {
      return [];
    }

    logger.animesalt(`[AnimeWorld] Series candidate slugs for "${title || options.slug}" S${season}E${episode}: ${candidateSlugs.join(', ')}`);

    for (const slug of candidateSlugs) {
      const ranges = await this.fetchSeriesSeasonMapping(slug);
      let effectiveSeason = season;
      let effectiveEpisode = episode;

      if (ranges.length > 0) {
        const mapped = this.calculateAbsoluteEpisode(ranges, season, episode);
        effectiveSeason = mapped.season;
        effectiveEpisode = mapped.episode;
      }

      const trialUrls = [
        `${this.baseUrl}/episode/${slug}-${effectiveSeason}x${effectiveEpisode}/`,
        `${this.baseUrl}/episode/${slug}-${season}x${episode}/`,
        `${this.baseUrl}/episode/${slug}-season-${season}-episode-${episode}/`,
        `${this.baseUrl}/episode/${slug}-${episode}/`,
      ];

      const uniqueTrials = Array.from(new Set(trialUrls));

      for (const episodeUrl of uniqueTrials) {
        const cacheKey = `waw_series_page:${episodeUrl}`;
        const cachedPlayerUrl = globalCache.get<string>(cacheKey);

        if (cachedPlayerUrl) {
          logger.animesalt(`[AnimeWorld] Cache hit player iframe for: ${episodeUrl}`);
          const playerResult = await zephyrixPlayerResolver.resolve(cachedPlayerUrl, episodeUrl);
          if (playerResult.streams.length > 0) {
            return playerResult.streams;
          }
        }

        try {
          logger.animesalt(`[AnimeWorld] Trying series episode URL: ${episodeUrl}`);
          const res = await axios.get(episodeUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
              Referer: `${this.baseUrl}/series/${slug}/`,
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
            const playerResult = await zephyrixPlayerResolver.resolve(playerUrl, episodeUrl);
            if (playerResult.streams.length > 0) {
              return playerResult.streams;
            }
          }
        } catch {
          // Continue to next trial URL
        }
      }
    }

    return [];
  }
}

export const watchAnimeWorldSeriesScraper = new WatchAnimeWorldSeriesScraper();
