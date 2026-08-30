export type MediaType = 'movie' | 'series' | 'anime';

export interface MediaIdentity {
  type: MediaType;
  imdbId?: string;
  tmdbId?: number | string;
  tvdbId?: number | string;
  title: string;
  originalTitle?: string;
  alternateTitles?: string[];
  year?: number;
  season?: number;
  episode?: number;
  seasonRangeStart?: number;
  seasonRangeEnd?: number;
}

export interface StreamCandidate {
  name: string;
  title: string;
  description?: string;
  url: string;
  quality: string;
  language: string;
  languages?: string[];
  type?: 'hls' | 'mp4' | 'iframe';
  headers?: Record<string, string>;
  behaviorHints?: {
    notWebReady?: boolean;
    bingeGroup?: string;
    proxyHeaders?: {
      request?: Record<string, string>;
    };
  };
}

export interface StremioStream {
  name: string;
  title: string;
  description?: string;
  url: string;
  behaviorHints?: {
    notWebReady?: boolean;
    bingeGroup?: string;
    proxyHeaders?: {
      request?: Record<string, string>;
    };
  };
}

export interface PlayerResult {
  streams: StreamCandidate[];
  title?: string;
  languages?: string[];
  subtitles?: { label: string; file: string }[];
}
