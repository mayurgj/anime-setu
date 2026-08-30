import { Router, Request, Response } from 'express';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { metadataResolver } from '../metadata/resolver.js';
import { movieScraper } from '../scrapers/animesalt/movie.js';
import { seriesScraper } from '../scrapers/animesalt/series.js';
import { watchAnimeWorldSeriesScraper } from '../scrapers/watchanimeworld/series.js';
import { watchAnimeWorldMovieScraper } from '../scrapers/watchanimeworld/movie.js';
import { resolveStremioStreams } from '../streams/resolver.js';
import { StreamCandidate, MediaIdentity } from '../streams/types.js';
import { buildMovieUrl, buildSeriesUrl } from '../utils/slug.js';
import { parseConfig, UserConfig } from '../utils/config.js';

export const streamRouter: Router = Router();

function slugToTitle(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function handleStreamRequest(
  req: Request,
  res: Response,
  type: string,
  rawId: string,
  configStr?: string
) {
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const host = req.get('host') || `localhost:${env.PORT}`;
  const protocol = req.protocol || 'http';
  const serverBaseUrl = `${protocol}://${host}`;
  const userConfig: UserConfig = parseConfig(configStr);
  const requestedSource = ((req.query.source as string) || '').toLowerCase();

  logger.request(
    `Stream requested: type=${type}, id=${id}, source=${requestedSource || 'all'}, config=${configStr || 'none'} (serverBaseUrl=${serverBaseUrl})`
  );

  try {
    let candidates: StreamCandidate[] = [];
    let resolvedMeta: MediaIdentity | null = null;

    if (type === 'movie') {
      const cleanId = id.replace(/\.json$/, '');
      resolvedMeta = await metadataResolver.resolveMovie(cleanId);

      const tasks: Promise<StreamCandidate[]>[] = [];

      if (requestedSource !== 'animeworld') {
        tasks.push(
          resolvedMeta
            ? movieScraper.scrape(resolvedMeta)
            : movieScraper.scrapeBySlug(cleanId)
        );
      }

      if (requestedSource !== 'animesalt') {
        tasks.push(
          resolvedMeta
            ? watchAnimeWorldMovieScraper.scrapeMovie({ title: resolvedMeta.title })
            : watchAnimeWorldMovieScraper.scrapeMovie({ slug: cleanId, title: slugToTitle(cleanId) })
        );
      }

      const results = await Promise.allSettled(tasks);

      if (!resolvedMeta) {
        resolvedMeta = {
          type: 'movie',
          title: slugToTitle(cleanId),
        };
      }

      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          candidates.push(...r.value);
        }
      }
    } else if (type === 'series' || type === 'anime') {
      const cleanId = id.replace(/\.json$/, '');
      const parts = cleanId.split(':');

      let baseId = cleanId;
      let season = 1;
      let episode = 1;

      if (parts.length >= 3) {
        episode = parseInt(parts[parts.length - 1], 10) || 1;
        season = parseInt(parts[parts.length - 2], 10) || 1;
        baseId = parts.slice(0, parts.length - 2).join(':');
      } else if (parts.length === 2) {
        episode = parseInt(parts[1], 10) || 1;
        baseId = parts[0];
      }

      logger.metadata(`Parsed series request: baseId="${baseId}", S${season}E${episode}`);
      resolvedMeta = await metadataResolver.resolveSeries(baseId, season, episode);

      const tasks: Promise<StreamCandidate[]>[] = [];

      if (requestedSource !== 'animeworld') {
        tasks.push(
          resolvedMeta
            ? seriesScraper.scrape(resolvedMeta)
            : seriesScraper.scrapeByEpisode(baseId, season, episode)
        );
      }

      if (requestedSource !== 'animesalt') {
        tasks.push(
          resolvedMeta
            ? watchAnimeWorldSeriesScraper.scrapeSeriesEpisode({
                season: resolvedMeta.season || season,
                episode: resolvedMeta.episode || episode,
                title: resolvedMeta.title,
              })
            : watchAnimeWorldSeriesScraper.scrapeSeriesEpisode({
                slug: baseId,
                season,
                episode,
                title: slugToTitle(baseId),
              })
        );
      }

      const results = await Promise.allSettled(tasks);

      if (!resolvedMeta) {
        resolvedMeta = {
          type: 'series',
          title: slugToTitle(baseId),
          season,
          episode,
        };
      }

      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          candidates.push(...r.value);
        }
      }
    }

    // Format Stremio streams with custom template name & description and user filtering
    const response = resolveStremioStreams(candidates, serverBaseUrl, resolvedMeta, userConfig);
    res.setHeader('Cache-Control', 'max-age=180, public');
    return res.json(response);
  } catch (err: any) {
    logger.error(`Error processing stream request for ${type}/${id}: ${err.message}`);
    return res.json({ streams: [] });
  }
}

// 1. Standard Stream endpoint: /stream/:type/:id.json
streamRouter.get('/stream/:type/:id.json', (req: Request, res: Response) => {
  return handleStreamRequest(req, res, req.params.type as string, req.params.id as string);
});

// 2. Configured Stream endpoint: /:config/stream/:type/:id.json
streamRouter.get('/:config/stream/:type/:id.json', (req: Request, res: Response) => {
  return handleStreamRequest(req, res, req.params.type as string, req.params.id as string, req.params.config as string);
});

// Debug endpoints
if (env.DEBUG) {
  streamRouter.get('/debug/animesalt/movie', async (req: Request, res: Response) => {
    const slug = req.query.slug as string;
    if (!slug) {
      return res.status(400).json({ error: 'Missing slug query param' });
    }

    const host = req.get('host') || `localhost:${env.PORT}`;
    const protocol = req.protocol || 'http';
    const serverBaseUrl = `${protocol}://${host}`;

    try {
      const sourceUrl = buildMovieUrl(slug);
      const candidates = await movieScraper.scrapeBySlug(slug);
      return res.json({
        sourceUrl,
        status: candidates.length > 0 ? 200 : 404,
        streamCandidates: candidates,
        stremioStreams: resolveStremioStreams(candidates, serverBaseUrl).streams,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  streamRouter.get('/debug/animesalt/episode', async (req: Request, res: Response) => {
    const slug = req.query.slug as string;
    const season = parseInt((req.query.season as string) || '1', 10);
    const episode = parseInt((req.query.episode as string) || '1', 10);

    if (!slug) {
      return res.status(400).json({ error: 'Missing slug query param' });
    }

    const host = req.get('host') || `localhost:${env.PORT}`;
    const protocol = req.protocol || 'http';
    const serverBaseUrl = `${protocol}://${host}`;

    try {
      const sourceUrl = buildSeriesUrl(slug, season, episode);
      const candidates = await seriesScraper.scrapeByEpisode(slug, season, episode);
      return res.json({
        sourceUrl,
        status: candidates.length > 0 ? 200 : 404,
        streamCandidates: candidates,
        stremioStreams: resolveStremioStreams(candidates, serverBaseUrl).streams,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
}
