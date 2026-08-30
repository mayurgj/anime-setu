import axios from 'axios';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { globalCache } from '../utils/cache.js';
import { MediaIdentity } from '../streams/types.js';

export class TvdbClient {
  private baseURL = 'https://api4.thetvdb.com/v4';
  private authToken: string | null = null;
  private tokenExpiresAt: number = 0;

  private async getAuthToken(): Promise<string | null> {
    if (!env.TVDB_API_KEY) return null;

    if (this.authToken && Date.now() < this.tokenExpiresAt) {
      return this.authToken;
    }

    try {
      logger.metadata('Authenticating with TVDB API v4');
      const res = await axios.post(`${this.baseURL}/login`, {
        apikey: env.TVDB_API_KEY,
      });

      if (res.data?.data?.token) {
        this.authToken = res.data.data.token;
        // Expire in 23 hours
        this.tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000;
        return this.authToken;
      }
    } catch (err: any) {
      logger.error(`TVDB authentication failed: ${err.message}`);
    }

    return null;
  }

  async getSeriesDetails(
    tvdbId: string,
    season: number = 1,
    episode: number = 1
  ): Promise<MediaIdentity | null> {
    const token = await this.getAuthToken();
    if (!token) return null;

    const cacheKey = `tvdb_series:${tvdbId}:${season}:${episode}`;
    const cached = globalCache.get<MediaIdentity>(cacheKey);
    if (cached) return cached;

    try {
      logger.metadata(`Querying TVDB series details: ${tvdbId}`);
      const res = await axios.get(`${this.baseURL}/series/${tvdbId}/extended`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        timeout: 8000,
      });

      const d = res.data?.data;
      if (!d) return null;

      const altTitles = (d.aliases || []).map((a: any) => a.name);

      const identity: MediaIdentity = {
        type: 'series',
        title: d.name,
        originalTitle: d.originalName,
        year: d.firstAired ? parseInt(d.firstAired.split('-')[0], 10) : undefined,
        season,
        episode,
        tvdbId: String(d.id),
        alternateTitles: altTitles,
      };

      globalCache.set(cacheKey, identity, env.CACHE_TTL_METADATA);
      return identity;
    } catch (err: any) {
      logger.error(`TVDB series details failed for ${tvdbId}: ${err.message}`);
    }

    return null;
  }
}

export const tvdbClient = new TvdbClient();
