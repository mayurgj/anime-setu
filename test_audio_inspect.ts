import axios from 'axios';
import { seriesScraper } from './src/scrapers/animesalt/series.js';

async function inspectAudio() {
  const streams = await seriesScraper.scrapeByEpisode('naruto-shippuden', 8, 163);
  // URL has &lang=hin&res=1080p appended; let's extract the raw URL
  const candidateUrl = streams[0].url;
  const rawMasterUrl = candidateUrl.replace(/&lang=[^&]+/, '').replace(/&res=[^&]+/, '');
  console.log('Raw Master URL:', rawMasterUrl);

  const res = await axios.get(rawMasterUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://as-cdn26.top/'
    }
  });

  console.log('Master Manifest:\n', res.data);
}

inspectAudio();
