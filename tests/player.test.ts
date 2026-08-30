import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { unpackJs, parsePlayerHtml, parseMasterManifest } from '../src/scrapers/animesalt/player.js';

describe('Player JS Deobfuscation & Metadata Extraction', () => {
  const moviePlayerHtml = fs.readFileSync(
    path.resolve(process.cwd(), 'fixtures/animesalt/movie-player.html'),
    'utf8'
  );
  const seriesPlayerHtml = fs.readFileSync(
    path.resolve(process.cwd(), 'fixtures/animesalt/series-player.html'),
    'utf8'
  );

  it('unpacks Dean Edwards packed javascript from movie player fixture', () => {
    const unpacked = unpackJs(moviePlayerHtml);
    expect(unpacked).toBeTruthy();
    expect(unpacked).toContain('FirePlayer');
    expect(unpacked).toContain('860e6390db45d650def1b4fa0c7dd667');
    expect(unpacked).toContain('Shinchan The Spicy Kasukabe Dancers');
  });

  it('unpacks Dean Edwards packed javascript from series player fixture', () => {
    const unpacked = unpackJs(seriesPlayerHtml);
    expect(unpacked).toBeTruthy();
    expect(unpacked).toContain('FirePlayer');
    expect(unpacked).toContain('05f971b5ec196b8c65b75d2ef8267331');
    expect(unpacked).toContain('Naruto Shippuden');
  });

  it('extracts metadata from movie player HTML', () => {
    const meta = parsePlayerHtml(moviePlayerHtml);
    expect(meta.title).toContain('Shinchan');
    expect(meta.defaultAudio).toBeDefined();
    expect(meta.defaultAudio).toContain('hin');
    expect(meta.defaultAudio).toContain('tam');
  });

  it('extracts metadata from series player HTML', () => {
    const meta = parsePlayerHtml(seriesPlayerHtml);
    expect(meta.title).toContain('Naruto Shippuden');
  });

  it('parses master manifest audio tracks and video variants', () => {
    const sampleManifest = `
#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",LANGUAGE="hin",NAME="Hindi",DEFAULT=YES,AUTOSELECT=YES,URI="/hls/hin.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",LANGUAGE="tam",NAME="Tamil",DEFAULT=NO,AUTOSELECT=YES,URI="/hls/tam.m3u8"
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=4096000,RESOLUTION=1920x1080,NAME="1080p",AUDIO="audio"
/hls/1080p.m3u8
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=2048000,RESOLUTION=1280x720,NAME="720p",AUDIO="audio"
/hls/720p.m3u8
`;
    const parsed = parseMasterManifest(sampleManifest);
    expect(parsed.audioTracks.length).toBe(2);
    expect(parsed.audioTracks[0].language).toBe('hin');
    expect(parsed.audioTracks[0].name).toBe('Hindi');
    expect(parsed.videoVariants.length).toBe(2);
    expect(parsed.videoVariants[0].resolution).toBe('1080p');
    expect(parsed.videoVariants[1].resolution).toBe('720p');
  });
});
