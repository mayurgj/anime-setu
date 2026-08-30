import { Router, Request, Response } from 'express';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import { DEFAULT_USER_AGENT, isAllowedDomain } from '../utils/http.js';

export const proxyRouter = Router();

/**
 * HLS Playlist and Segment Proxy
 * - Rewrites master & variant playlists
 * - Sets default audio track based on target language (e.g. Hindi sorted to top with DEFAULT=YES)
 * - Prioritizes requested resolution (e.g. 1080p, 720p)
 * - Unmasks disguised .js / .css chunks into proper video/mp2t stream packets
 * - Fixes CORS, Referer, and User-Agent headers for seamless Stremio playback
 */
proxyRouter.get('/proxy/hls', async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).send('Missing "url" query parameter');
  }

  if (!isAllowedDomain(targetUrl)) {
    return res.status(403).send('Target domain not permitted');
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const origin = parsedUrl.origin;
    const host = req.get('host') || 'localhost:7000';
    const protocol = req.protocol || 'http';
    const serverBaseUrl = `${protocol}://${host}`;

    // Extract language & resolution from BOTH query params and URL search params
    const requestedLang = (
      (req.query.lang as string) ||
      parsedUrl.searchParams.get('lang') ||
      ''
    ).toLowerCase();

    const requestedRes = (
      (req.query.res as string) ||
      parsedUrl.searchParams.get('res') ||
      ''
    ).toLowerCase();

    let referer = `${origin}/`;
    if (parsedUrl.hostname.includes('zn-grid')) {
      referer = 'https://play.zephyrix.org/';
    } else if (parsedUrl.hostname.includes('zephyrix.org')) {
      referer = 'https://watchanimeworld.one/';
    }

    const requestHeaders: Record<string, string> = {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: referer,
      Accept: '*/*',
    };
    if (req.headers.range) {
      requestHeaders.Range = req.headers.range;
    }

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: requestHeaders,
      timeout: 15000,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const contentType = String(response.headers['content-type'] || '');
    const firstBytes = response.data.slice(0, 10).toString();
    const isM3u8 =
      contentType.includes('mpegurl') ||
      contentType.includes('m3u8') ||
      targetUrl.includes('.m3u8') ||
      firstBytes.startsWith('#EXTM3U');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

    if (isM3u8) {
      const manifestText = Buffer.from(response.data).toString('utf8');
      const lines = manifestText.split('\n');
      const basePath = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

      const headerLines: string[] = [];
      const audioLines: string[] = [];
      const variantPairs: { inf: string; uri: string; resolution: string }[] = [];
      const segmentLines: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Collect header tags
        if (
          trimmed.startsWith('#EXTM3U') ||
          trimmed.startsWith('#EXT-X-VERSION') ||
          trimmed.startsWith('##')
        ) {
          headerLines.push(line);
          continue;
        }

        // 1. Collect Audio Tracks
        if (trimmed.startsWith('#EXT-X-MEDIA:TYPE=AUDIO')) {
          const mediaRewritten = line.replace(/URI="([^"]+)"/, (_, uri) => {
            const absoluteMediaUrl = uri.startsWith('http')
              ? uri
              : new URL(uri, origin).toString();
            return `URI="${serverBaseUrl}/proxy/hls?url=${encodeURIComponent(absoluteMediaUrl)}"`;
          });
          audioLines.push(mediaRewritten);
          continue;
        }

        // 2. Encryption Key
        if (trimmed.startsWith('#EXT-X-KEY:')) {
          const keyRewritten = line.replace(/URI="([^"]+)"/, (_, keyUri) => {
            const absoluteKeyUrl = keyUri.startsWith('http')
              ? keyUri
              : new URL(keyUri, origin).toString();
            return `URI="${serverBaseUrl}/proxy/hls?url=${encodeURIComponent(absoluteKeyUrl)}"`;
          });
          headerLines.push(keyRewritten);
          continue;
        }

        // 3. Video Stream Variant (#EXT-X-STREAM-INF:)
        if (trimmed.startsWith('#EXT-X-STREAM-INF:')) {
          const resMatch =
            trimmed.match(/NAME="([^"]+)"/i) || trimmed.match(/RESOLUTION=\d+x(\d+)/i);
          const resolution = resMatch
            ? resMatch[1].includes('p')
              ? resMatch[1].toLowerCase()
              : `${resMatch[1]}p`
            : 'auto';

          const nextLine = lines[++i]?.trim() || '';
          let absoluteVariantUrl: string;
          if (nextLine.startsWith('http://') || nextLine.startsWith('https://')) {
            absoluteVariantUrl = nextLine;
          } else if (nextLine.startsWith('/')) {
            absoluteVariantUrl = `${origin}${nextLine}`;
          } else {
            absoluteVariantUrl = new URL(nextLine, basePath).toString();
          }

          variantPairs.push({
            inf: line,
            uri: `${serverBaseUrl}/proxy/hls?url=${encodeURIComponent(absoluteVariantUrl)}`,
            resolution,
          });
          continue;
        }

        // 4. Sub-playlist tags and segments
        if (trimmed.startsWith('#')) {
          segmentLines.push(line);
          continue;
        }

        // 5. Segment chunk URI
        let absoluteSegmentUrl: string;
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          absoluteSegmentUrl = trimmed;
        } else if (trimmed.startsWith('/')) {
          absoluteSegmentUrl = `${origin}${trimmed}`;
        } else {
          absoluteSegmentUrl = new URL(trimmed, basePath).toString();
        }

        segmentLines.push(
          `${serverBaseUrl}/proxy/hls?url=${encodeURIComponent(absoluteSegmentUrl)}`
        );
      }

      // Reorder and configure Audio Tracks (Hindi/Target Language First!)
      const processedAudioLines: string[] = [];
      if (audioLines.length > 0) {
        if (requestedLang && requestedLang !== 'all') {
          // Sort target language to index 0
          audioLines.sort((a, b) => {
            const isA =
              a.toLowerCase().includes(`language="${requestedLang}"`) ||
              a.toLowerCase().includes(`name="${requestedLang}"`);
            const isB =
              b.toLowerCase().includes(`language="${requestedLang}"`) ||
              b.toLowerCase().includes(`name="${requestedLang}"`);
            if (isA && !isB) return -1;
            if (!isA && isB) return 1;
            return 0;
          });

          for (let j = 0; j < audioLines.length; j++) {
            const line = audioLines[j];
            const isTarget =
              line.toLowerCase().includes(`language="${requestedLang}"`) ||
              line.toLowerCase().includes(`name="${requestedLang}"`);

            if (isTarget && j === 0) {
              // Primary track: DEFAULT=YES, AUTOSELECT=YES
              processedAudioLines.push(
                line
                  .replace(/DEFAULT=[A-Z]+/i, 'DEFAULT=YES')
                  .replace(/AUTOSELECT=[A-Z]+/i, 'AUTOSELECT=YES')
              );
            } else {
              // Secondary tracks: DEFAULT=NO, AUTOSELECT=NO
              processedAudioLines.push(
                line
                  .replace(/DEFAULT=[A-Z]+/i, 'DEFAULT=NO')
                  .replace(/AUTOSELECT=[A-Z]+/i, 'AUTOSELECT=NO')
              );
            }
          }
        } else {
          // Default Multi-audio
          processedAudioLines.push(...audioLines);
        }
      }

      // Reorder video variants if specific resolution requested
      const processedVariantLines: string[] = [];
      if (variantPairs.length > 0) {
        if (requestedRes && requestedRes !== 'auto') {
          variantPairs.sort((a, b) => {
            if (a.resolution === requestedRes) return -1;
            if (b.resolution === requestedRes) return 1;
            return 0;
          });
        }
        for (const pair of variantPairs) {
          processedVariantLines.push(pair.inf);
          processedVariantLines.push(pair.uri);
        }
      }

      const finalManifest = [
        ...headerLines,
        ...processedAudioLines,
        ...processedVariantLines,
        ...segmentLines,
      ].join('\n');

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(finalManifest);
    }

    // Binary TS segment chunk: Force video/mp2t MIME type
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    if (response.headers['content-range']) {
      res.setHeader('Content-Range', response.headers['content-range']);
    }

    return res.status(response.status).send(response.data);
  } catch (err: any) {
    logger.error(`HLS Proxy failed for URL: ${targetUrl} - ${err.message}`);
    return res.status(502).send(`Proxy Error: ${err.message}`);
  }
});

proxyRouter.head('/proxy/hls', async (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'video/mp2t');
  res.status(200).end();
});
