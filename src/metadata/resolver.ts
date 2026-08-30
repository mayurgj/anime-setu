import { MediaIdentity } from '../streams/types.js';
import { tmdbClient } from './tmdb.js';
import { tvdbClient } from './tvdb.js';
import { logger } from '../utils/logger.js';

export class MetadataResolver {
  /**
   * Resolve movie metadata from Stremio media ID
   */
  async resolveMovie(id: string): Promise<MediaIdentity | null> {
    logger.metadata(`Resolving movie metadata for ID: ${id}`);

    // Case 1: TMDB ID (tmdb:12345 or 12345)
    if (id.startsWith('tmdb:')) {
      const tmdbId = id.replace('tmdb:', '');
      return tmdbClient.getMovieDetails(tmdbId);
    }

    // Case 2: IMDb ID (tt1234567)
    if (id.startsWith('tt')) {
      const findRes = await tmdbClient.findByImdbId(id);
      if (findRes && findRes.type === 'movie') {
        return tmdbClient.getMovieDetails(findRes.tmdbId);
      }
    }

    // Fallback: if numeric only, try TMDB
    if (/^\d+$/.test(id)) {
      return tmdbClient.getMovieDetails(id);
    }

    logger.metadata(`Could not resolve movie ID ${id} via TMDB`);
    return null;
  }

  /**
   * Resolve series episode metadata from Stremio media ID, season, and episode
   */
  async resolveSeries(id: string, season: number = 1, episode: number = 1): Promise<MediaIdentity | null> {
    logger.metadata(`Resolving series metadata for ID: ${id} S${season}E${episode}`);

    // Case 1: TMDB ID (tmdb:12345)
    if (id.startsWith('tmdb:')) {
      const tmdbId = id.replace('tmdb:', '');
      return tmdbClient.getSeriesDetails(tmdbId, season, episode);
    }

    // Case 2: TVDB ID (tvdb:12345)
    if (id.startsWith('tvdb:')) {
      const tvdbId = id.replace('tvdb:', '');
      return tvdbClient.getSeriesDetails(tvdbId, season, episode);
    }

    // Case 3: IMDb ID (tt1234567)
    if (id.startsWith('tt')) {
      const findRes = await tmdbClient.findByImdbId(id);
      if (findRes && findRes.type === 'series') {
        return tmdbClient.getSeriesDetails(findRes.tmdbId, season, episode);
      }
    }

    // Fallback: if numeric only, try TMDB
    if (/^\d+$/.test(id)) {
      return tmdbClient.getSeriesDetails(id, season, episode);
    }

    logger.metadata(`Could not resolve series ID ${id} via TMDB/TVDB`);
    return null;
  }
}

export const metadataResolver = new MetadataResolver();
