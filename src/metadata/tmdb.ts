import axios from 'axios';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { globalCache } from '../utils/cache.js';
import { MediaIdentity } from '../streams/types.js';

export class TmdbClient {
  private baseURL = 'https://api.themoviedb.org/3';

  private get headers(): Record<string, string> {
    if (env.TMDB_READ_TOKEN) {
      return {
        Authorization: `Bearer ${env.TMDB_READ_TOKEN}`,
        Accept: 'application/json',
      };
    }
    return {
      Accept: 'application/json',
    };
  }

  private get authParams(): Record<string, string> {
    if (!env.TMDB_READ_TOKEN && env.TMDB_API_KEY) {
      return { api_key: env.TMDB_API_KEY };
    }
    return {};
  }

  async findByImdbId(imdbId: string): Promise<{ type: 'movie' | 'series'; tmdbId: string } | null> {
    const cacheKey = `tmdb_find:${imdbId}`;
    const cached = globalCache.get<{ type: 'movie' | 'series'; tmdbId: string }>(cacheKey);
    if (cached) return cached;

    try {
      logger.metadata(`Querying TMDB find by IMDb ID: ${imdbId}`);
      const res = await axios.get(`${this.baseURL}/find/${imdbId}`, {
        params: {
          external_source: 'imdb_id',
          ...this.authParams,
        },
        headers: this.headers,
        timeout: 8000,
      });

      const data = res.data;
      if (data.movie_results && data.movie_results.length > 0) {
        const result = { type: 'movie' as const, tmdbId: String(data.movie_results[0].id) };
        globalCache.set(cacheKey, result, env.CACHE_TTL_METADATA);
        return result;
      }
      if (data.tv_results && data.tv_results.length > 0) {
        const result = { type: 'series' as const, tmdbId: String(data.tv_results[0].id) };
        globalCache.set(cacheKey, result, env.CACHE_TTL_METADATA);
        return result;
      }
    } catch (err: any) {
      logger.error(`TMDB find failed for ${imdbId}: ${err.message}`);
    }

    return null;
  }

  async getMovieDetails(tmdbId: string): Promise<MediaIdentity | null> {
    const cacheKey = `tmdb_movie:${tmdbId}`;
    const cached = globalCache.get<MediaIdentity>(cacheKey);
    if (cached) return cached;

    try {
      logger.metadata(`Querying TMDB movie details: ${tmdbId}`);
      const res = await axios.get(`${this.baseURL}/movie/${tmdbId}`, {
        params: {
          append_to_response: 'alternative_titles',
          ...this.authParams,
        },
        headers: this.headers,
        timeout: 8000,
      });

      const d = res.data;
      const altTitles = (d.alternative_titles?.titles || []).map((t: any) => t.title);

      const identity: MediaIdentity = {
        type: 'movie',
        title: d.title,
        originalTitle: d.original_title,
        year: d.release_date ? parseInt(d.release_date.split('-')[0], 10) : undefined,
        tmdbId: String(d.id),
        imdbId: d.imdb_id,
        alternateTitles: altTitles,
      };

      globalCache.set(cacheKey, identity, env.CACHE_TTL_METADATA);
      return identity;
    } catch (err: any) {
      logger.error(`TMDB movie details failed for ${tmdbId}: ${err.message}`);
    }

    return null;
  }

  async getSeriesDetails(
    tmdbId: string,
    season: number = 1,
    episode: number = 1
  ): Promise<MediaIdentity | null> {
    const cacheKey = `tmdb_tv:${tmdbId}:${season}:${episode}`;
    const cached = globalCache.get<MediaIdentity>(cacheKey);
    if (cached) return cached;

    try {
      logger.metadata(`Querying TMDB series details: ${tmdbId} S${season}E${episode}`);
      const res = await axios.get(`${this.baseURL}/tv/${tmdbId}`, {
        params: {
          append_to_response: 'alternative_titles',
          ...this.authParams,
        },
        headers: this.headers,
        timeout: 8000,
      });

      const d = res.data;
      const altTitles = (d.alternative_titles?.results || []).map((t: any) => t.title);

      const identity: MediaIdentity = {
        type: 'series',
        title: d.name,
        originalTitle: d.original_name,
        year: d.first_air_date ? parseInt(d.first_air_date.split('-')[0], 10) : undefined,
        season,
        episode,
        tmdbId: String(d.id),
        alternateTitles: altTitles,
      };

      globalCache.set(cacheKey, identity, env.CACHE_TTL_METADATA);
      return identity;
    } catch (err: any) {
      logger.error(`TMDB series details failed for ${tmdbId}: ${err.message}`);
    }

    return null;
  }
}

export const tmdbClient = new TmdbClient();
