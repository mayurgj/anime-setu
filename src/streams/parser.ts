import { StreamCandidate, StremioStream } from './types.js';

export function detectQuality(text: string): string {
  if (/\b(2160p|4k|uhd)\b/i.test(text)) return '4K';
  if (/\b(1440p|2k)\b/i.test(text)) return '2K';
  if (/\b1080p\b/i.test(text)) return '1080p';
  if (/\b720p\b/i.test(text)) return '720p';
  if (/\b480p\b/i.test(text)) return '480p';
  if (/\b360p\b/i.test(text)) return '360p';
  return 'Auto';
}

const LANGUAGE_PRIORITY_ORDER = [
  'Hindi',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Bengali',
  'Marathi',
  'Kannada',
  'English',
  'Japanese',
  'Korean',
  'Multi Audio',
];

export function sortLanguagesWithPriority(
  languages: string[],
  priorityLang: string = 'Hindi'
): string[] {
  const unique = Array.from(new Set(languages));
  return unique.sort((a, b) => {
    // 1. Explicit priority language always #1
    if (a.toLowerCase() === priorityLang.toLowerCase()) return -1;
    if (b.toLowerCase() === priorityLang.toLowerCase()) return 1;

    // 2. Hindi always next priority if priorityLang was something else
    if (a.toLowerCase() === 'hindi') return -1;
    if (b.toLowerCase() === 'hindi') return 1;

    const idxA = LANGUAGE_PRIORITY_ORDER.findIndex(
      (l) => l.toLowerCase() === a.toLowerCase()
    );
    const idxB = LANGUAGE_PRIORITY_ORDER.findIndex(
      (l) => l.toLowerCase() === b.toLowerCase()
    );

    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });
}

export function detectLanguages(text: string): string[] {
  const langs: string[] = [];
  if (/\b(hindi|hin|dub in hindi)\b/i.test(text)) langs.push('Hindi');
  if (/\b(tamil|tam)\b/i.test(text)) langs.push('Tamil');
  if (/\b(telugu|tel)\b/i.test(text)) langs.push('Telugu');
  if (/\b(malayalam|mal)\b/i.test(text)) langs.push('Malayalam');
  if (/\b(bengali|ben)\b/i.test(text)) langs.push('Bengali');
  if (/\b(marathi|mar)\b/i.test(text)) langs.push('Marathi');
  if (/\b(kannada|kan)\b/i.test(text)) langs.push('Kannada');
  if (/\b(english|eng)\b/i.test(text)) langs.push('English');
  if (/\b(japanese|jap|jpn)\b/i.test(text)) langs.push('Japanese');
  if (/\b(multi|dual audio)\b/i.test(text) && langs.length === 0) langs.push('Multi Audio');
  return sortLanguagesWithPriority(langs.length > 0 ? langs : ['Multi Audio'], 'Hindi');
}

export function detectStreamType(url: string): 'hls' | 'mp4' | 'iframe' {
  if (url.includes('.m3u8') || url.includes('/hls/')) return 'hls';
  if (url.includes('.mp4')) return 'mp4';
  return 'iframe';
}

export function formatStreamName(resolution: string): string {
  let resText = resolution || 'Auto';
  if (resText.toLowerCase() === '2160p' || resText.toLowerCase() === '4k') {
    resText = '   4K ';
  } else if (resText.toLowerCase() === '1440p' || resText.toLowerCase() === '2k') {
    resText = '    2K ';
  } else if (resText.toLowerCase() === 'auto') {
    resText = '  AUTO ';
  } else {
    resText = resText.replace('p', 'P');
    resText = resText.padStart(5, ' ');
  }

  return `${resText}⁽ʷᵉᵇ⁾⚡\n  〈WEB-DL〉`;
}

function toSubscript(numStr: string): string {
  const map: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  };
  return numStr.split('').map((c) => map[c] || c).join('');
}

export function formatStreamDescription(opts: {
  title?: string;
  year?: number;
  season?: number;
  episode?: number;
  languages?: string[];
  encode?: string;
  provider?: string;
  defaultLang?: string;
}): string {
  const parts: string[] = [];

  // Line 1: Title, Year, Season/Episode with unicode subscripts
  let line1 = `✎  ${(opts.title || 'Anime Setu').slice(0, 20)}`;
  if (opts.year) {
    line1 += ` · (${opts.year})`;
  }
  if (opts.season && opts.episode) {
    const sStr = opts.season < 10 ? `0${opts.season}` : `${opts.season}`;
    const eStr = opts.episode < 10 ? `0${opts.episode}` : `${opts.episode}`;
    line1 += `  s${toSubscript(sStr)}·ᴇ${toSubscript(eStr)}`;
  }
  parts.push(line1);

  // Line 2: Audio & Video encode tags
  parts.push(`♬  AAC · 2.0`);

  // Line 3: Addon & Proxy info
  const providerTag = opts.provider ? ` [${opts.provider}]` : '';
  parts.push(`⛊ Anime Setu${providerTag}`);

  // Line 4: Languages available in the stream (Hindi is ALWAYS #1)
  if (opts.languages && opts.languages.length > 0) {
    const sortedLangs = sortLanguagesWithPriority(
      opts.languages,
      opts.defaultLang || 'Hindi'
    );
    parts.push(`✓ ${sortedLangs.join(' · ')}`);
  }

  return parts.join('\n');
}

export function candidateToStremioStream(
  candidate: StreamCandidate,
  defaultLang?: string
): StremioStream {
  const name = formatStreamName(candidate.quality);
  const title =
    candidate.description ||
    formatStreamDescription({
      title: candidate.title,
      languages: candidate.languages,
      provider: candidate.name !== 'Anime Setu' ? candidate.name : undefined,
      defaultLang,
    });

  return {
    name,
    title,
    url: candidate.url,
    behaviorHints: {
      notWebReady: candidate.behaviorHints?.notWebReady ?? false,
      bingeGroup:
        candidate.behaviorHints?.bingeGroup ||
        `animesetu-${candidate.quality.toLowerCase()}`,
    },
  };
}
