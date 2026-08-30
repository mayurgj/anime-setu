import { StreamCandidate, StremioStream, MediaIdentity } from './types.js';
import { formatStreamName, formatStreamDescription } from './parser.js';
import { logger } from '../utils/logger.js';
import { UserConfig } from '../utils/config.js';

export function resolveStremioStreams(
  candidates: StreamCandidate[],
  serverBaseUrl?: string,
  metadata?: MediaIdentity | null,
  config?: UserConfig
): { streams: StremioStream[] } {
  if (!candidates || candidates.length === 0) {
    logger.stream('No stream candidates available');
    return { streams: [] };
  }

  const seenUrls = new Set<string>();
  let streams: StremioStream[] = [];

  // Filter candidates by user configured resolutions if provided
  let filteredCandidates = candidates;
  if (config?.resolutions && config.resolutions.length > 0) {
    const allowed = config.resolutions.map((r) => r.toLowerCase().trim());
    filteredCandidates = candidates.filter((c) =>
      allowed.includes(c.quality.toLowerCase().trim())
    );
    if (filteredCandidates.length === 0) {
      filteredCandidates = candidates; // Fallback to all if filtering produces empty
    }
  }

  for (const candidate of filteredCandidates) {
    if (!candidate.url || seenUrls.has(candidate.url)) {
      continue;
    }
    seenUrls.add(candidate.url);

    // Format Name using template
    const name = formatStreamName(candidate.quality);

    // Format Description using template
    const title = formatStreamDescription({
      title: metadata?.title || candidate.title,
      year: metadata?.year,
      season: metadata?.season,
      episode: metadata?.episode,
      languages: candidate.languages,
      provider: candidate.name,
      defaultLang: config?.defaultLang || 'Hindi',
    });

    let streamUrl = candidate.url;

    // Apply user default audio language if specified
    if (config?.defaultLang) {
      streamUrl = streamUrl.replace(/lang=[^&]+/, `lang=${encodeURIComponent(config.defaultLang)}`);
    }

    if (serverBaseUrl) {
      streamUrl = `${serverBaseUrl.replace(/\/+$/, '')}/proxy/hls?url=${encodeURIComponent(
        streamUrl
      )}`;
    }

    const stremioStream: StremioStream = {
      name,
      title,
      url: streamUrl,
      behaviorHints: {
        notWebReady: candidate.behaviorHints?.notWebReady ?? false,
        bingeGroup:
          candidate.behaviorHints?.bingeGroup || `animesetu-${candidate.quality.toLowerCase()}`,
      },
    };

    streams.push(stremioStream);
    logger.stream(
      `Resolved stream: [${stremioStream.name.replace(/\n/g, ' ')}] -> ${stremioStream.url}`
    );
  }

  // Limit maximum streams if configured
  if (config?.maxStreams && config.maxStreams > 0) {
    streams = streams.slice(0, config.maxStreams);
  }

  return { streams };
}
