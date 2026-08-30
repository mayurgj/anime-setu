import { StreamCandidate, PlayerResult } from '../../streams/types.js';

export interface WatchAnimeWorldEpisodeInfo {
  episodeNumber: number;
  seasonNumber?: number;
  slug: string;
  title: string;
  url: string;
}

export interface WatchAnimeWorldSeriesPageData {
  title: string;
  slug: string;
  episodes: WatchAnimeWorldEpisodeInfo[];
  seasons: { seasonNumber: number; episodes: WatchAnimeWorldEpisodeInfo[] }[];
}

export interface WatchAnimeWorldMoviePageData {
  title: string;
  slug: string;
  playerUrl?: string;
}

export interface ScrapeOptions {
  slug?: string;
  season?: number;
  episode?: number;
  title?: string;
}
