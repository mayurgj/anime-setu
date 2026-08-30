import { describe, it, expect } from 'vitest';
import { parseZephyrixMasterManifest } from '../src/scrapers/watchanimeworld/player.js';
import { watchAnimeWorldSeriesScraper } from '../src/scrapers/watchanimeworld/series.js';
import { watchAnimeWorldMovieScraper } from '../src/scrapers/watchanimeworld/movie.js';

describe('WatchAnimeWorld Scraper Tests', () => {
  it('parses Zephyrix master manifest with audio renditions and video resolutions', () => {
    const sampleManifest = `
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",LANGUAGE="jpn",NAME="Japanese",DEFAULT=NO,AUTOSELECT=YES,URI="/hls/jpn.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",LANGUAGE="hin",NAME="Hindi",DEFAULT=YES,AUTOSELECT=YES,URI="/hls/hin.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",LANGUAGE="tam",NAME="Tamil",DEFAULT=NO,AUTOSELECT=YES,URI="/hls/tam.m3u8"
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=4096000,RESOLUTION=1920x1080,NAME="1080p",CODECS="avc1.640028,mp4a.40.2",AUDIO="audio"
/hls/1080p.m3u8
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=2048000,RESOLUTION=1280x720,NAME="720p",CODECS="avc1.4D401F,mp4a.40.2",AUDIO="audio"
/hls/720p.m3u8
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=750000,RESOLUTION=842x480,NAME="480p",CODECS="avc1.4D401E,mp4a.40.2",AUDIO="audio"
/hls/480p.m3u8
`;

    const info = parseZephyrixMasterManifest(sampleManifest);
    expect(info.audioTracks.length).toBe(3);
    expect(info.videoVariants.length).toBe(3);
    expect(info.videoVariants.map((v) => v.resolution)).toEqual(['1080p', '720p', '480p']);
  });

  it('generates candidate slugs for titles correctly', () => {
    const slugs = watchAnimeWorldSeriesScraper.generateCandidateSlugs('Naruto Shippūden');
    expect(slugs).toContain('naruto-shippuden');
    expect(slugs.length).toBeGreaterThanOrEqual(1);

    const movieSlugs = watchAnimeWorldMovieScraper.generateCandidateSlugs('Shinchan Movie');
    expect(movieSlugs).toContain('shinchan-movie');
  });

  it('calculates absolute episode correctly from season ranges', () => {
    const ranges = [
      { seasonNumber: 1, startEp: 1, endEp: 32, totalEps: 32 },
      { seasonNumber: 2, startEp: 33, endEp: 53, totalEps: 21 },
      { seasonNumber: 16, startEp: 349, endEp: 361, totalEps: 13 },
    ];

    const s16e1 = watchAnimeWorldSeriesScraper.calculateAbsoluteEpisode(ranges, 16, 1);
    expect(s16e1.episode).toBe(349);

    const s2e1 = watchAnimeWorldSeriesScraper.calculateAbsoluteEpisode(ranges, 2, 1);
    expect(s2e1.episode).toBe(33);
  });
});
