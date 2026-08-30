import axios from 'axios';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { globalCache } from '../../utils/cache.js';
import { StreamCandidate, PlayerResult } from '../../streams/types.js';
import { detectStreamType, sortLanguagesWithPriority } from '../../streams/parser.js';

export interface AudioTrackInfo {
  language: string;
  name: string;
}

export interface VideoVariantInfo {
  resolution: string;
  bandwidth: number;
}

export function parseZephyrixMasterManifest(manifestText: string): {
  audioTracks: AudioTrackInfo[];
  videoVariants: VideoVariantInfo[];
} {
  const audioTracks: AudioTrackInfo[] = [];
  const videoVariants: VideoVariantInfo[] = [];
  const seenLangs = new Set<string>();

  const lines = manifestText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXT-X-MEDIA:TYPE=AUDIO')) {
      const langMatch = line.match(/LANGUAGE="([^"]+)"/i);
      const nameMatch = line.match(/NAME="([^"]+)"/i);

      if (langMatch) {
        const langCode = langMatch[1].toLowerCase();
        if (!seenLangs.has(langCode)) {
          seenLangs.add(langCode);
          audioTracks.push({
            language: langCode,
            name: nameMatch ? nameMatch[1] : langCode.toUpperCase(),
          });
        }
      }
    }

    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const resMatch = line.match(/NAME="([^"]+)"/i) || line.match(/RESOLUTION=\d+x(\d+)/i);
      const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
      const resolution = resMatch
        ? resMatch[1].includes('p')
          ? resMatch[1]
          : `${resMatch[1]}p`
        : '1080p';

      videoVariants.push({
        resolution,
        bandwidth: bwMatch ? parseInt(bwMatch[1], 10) : 0,
      });
    }
  }

  return { audioTracks, videoVariants };
}

const LANGUAGE_PRIORITY_NAMES: Record<string, string> = {
  hin: 'Hindi',
  tam: 'Tamil',
  tel: 'Telugu',
  mal: 'Malayalam',
  ben: 'Bengali',
  mar: 'Marathi',
  kan: 'Kannada',
  eng: 'English',
  jpn: 'Japanese',
  kor: 'Korean',
};

const RESOLUTION_ORDER = ['1080p', '720p', '480p', '360p'];

export class ZephyrixPlayerResolver {
  async resolve(playerUrl: string, refererUrl: string = env.WATCHANIMEWORLD_BASE_URL): Promise<PlayerResult> {
    const videoIdMatch = playerUrl.match(/\/video\/([a-f0-9]{32})/i);
    if (!videoIdMatch) {
      logger.player(`[AnimeWorld] Could not extract video ID from player URL: ${playerUrl}`);
      return { streams: [] };
    }

    const videoId = videoIdMatch[1];
    const cacheKey = `zephyrix_player_v1:${videoId}`;
    const cached = globalCache.get<PlayerResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const cdnBase = new URL(playerUrl).origin;

    try {
      // 1. Initial GET to obtain session cookies and player HTML
      logger.player(`[AnimeWorld] Fetching player page: ${playerUrl}`);
      const initRes = await axios.get(playerUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          Referer: refererUrl.endsWith('/') ? refererUrl : `${refererUrl}/`,
        },
        timeout: 10000,
      });

      const cookies =
        initRes.headers['set-cookie']?.map((c) => c.split(';')[0]).join('; ') || '';

      // 2. POST to /player/index.php?data=${videoId}&do=getVideo
      const postUrl = `${cdnBase}/player/index.php?data=${videoId}&do=getVideo`;
      logger.player(`[AnimeWorld] Requesting stream source from: ${postUrl}`);

      const postRes = await axios.post(
        postUrl,
        new URLSearchParams({
          hash: videoId,
          r: refererUrl,
        }).toString(),
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            Referer: playerUrl,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            ...(cookies ? { Cookie: cookies } : {}),
          },
          timeout: 10000,
        }
      );

      const data = postRes.data;
      if (!data || typeof data !== 'object') {
        logger.player(`[AnimeWorld] Invalid response from getVideo for ID ${videoId}`);
        return { streams: [] };
      }

      const rawStreamUrl = data.securedLink || data.videoSource;
      if (!rawStreamUrl) {
        logger.player(`[AnimeWorld] No video source URL returned for ID ${videoId}`);
        return { streams: [] };
      }

      logger.stream(`[AnimeWorld] Found playable media master playlist: ${rawStreamUrl}`);

      // 3. Inspect Master Manifest for Audio Tracks and Resolution Variants
      let availableLangs: string[] = [];
      let availableResolutions: string[] = [];

      try {
        const manifestRes = await axios.get(rawStreamUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            Referer: `${cdnBase}/`,
          },
          timeout: 8000,
        });

        const manifestInfo = parseZephyrixMasterManifest(manifestRes.data);
        availableLangs = manifestInfo.audioTracks.map((a) => {
          return LANGUAGE_PRIORITY_NAMES[a.language] || a.name;
        });
        availableResolutions = manifestInfo.videoVariants.map((v) => v.resolution);
      } catch (err: any) {
        logger.player(`[AnimeWorld] Could not pre-fetch master manifest: ${err.message}`);
      }

      if (availableLangs.length === 0) {
        availableLangs = ['Hindi', 'Multi Audio'];
      } else {
        availableLangs = sortLanguagesWithPriority(availableLangs, 'Hindi');
      }

      // Sort resolutions from highest to lowest (1080p, 720p, 480p, 360p)
      const sortedResolutions = RESOLUTION_ORDER.filter((r) =>
        availableResolutions.includes(r)
      );

      if (sortedResolutions.length === 0) {
        sortedResolutions.push('1080p', '720p', '480p');
      }

      const streams: StreamCandidate[] = [];

      // Generate 1 stream option per distinct resolution (Hindi as default audio)
      for (const res of sortedResolutions) {
        streams.push({
          name: 'AnimeWorld',
          title: res,
          url: `${rawStreamUrl}&lang=hin&res=${res}`,
          quality: res,
          language: 'Multi Audio',
          languages: availableLangs,
          type: detectStreamType(rawStreamUrl),
          behaviorHints: {
            bingeGroup: `animeworld-${res}`,
            notWebReady: false,
          },
        });
      }

      const result: PlayerResult = {
        streams,
        languages: availableLangs,
      };

      globalCache.set(cacheKey, result, env.CACHE_TTL_STREAM_URL);
      return result;
    } catch (err: any) {
      logger.error(`[AnimeWorld] Error resolving player for ${playerUrl}: ${err.message}`);
      return { streams: [] };
    }
  }
}

export const zephyrixPlayerResolver = new ZephyrixPlayerResolver();
