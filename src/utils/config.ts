export interface UserConfig {
  defaultLang?: string; // Primary default audio language, e.g. 'hin', 'tam', 'eng', 'jpn'
  resolutions?: string[]; // Allowed resolutions, e.g. ['1080p', '720p']
  languages?: string[]; // Allowed stream languages
  maxStreams?: number; // Maximum streams to return
}

export function parseConfig(configStr?: string): UserConfig {
  if (!configStr || configStr === 'manifest.json') return {};

  // Try base64url or base64 JSON
  try {
    let base64 = configStr;
    // Add padding if needed
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    if (decoded.startsWith('{') && decoded.endsWith('}')) {
      return JSON.parse(decoded);
    }
  } catch {}

  // Try URI decoded JSON
  try {
    const uriDecoded = decodeURIComponent(configStr);
    if (uriDecoded.startsWith('{') && uriDecoded.endsWith('}')) {
      return JSON.parse(uriDecoded);
    }
  } catch {}

  // Try query string style: lang=hin&res=1080p,720p
  try {
    const params = new URLSearchParams(configStr.replace(/\|/g, '&'));
    const config: UserConfig = {};
    if (params.get('lang')) config.defaultLang = params.get('lang')!;
    if (params.get('res')) config.resolutions = params.get('res')!.split(',').map((r) => r.trim().toLowerCase());
    if (params.get('langs')) config.languages = params.get('langs')!.split(',').map((l) => l.trim().toLowerCase());
    if (params.get('max')) config.maxStreams = parseInt(params.get('max')!, 10);
    return config;
  } catch {}

  return {};
}

export function serializeConfig(config: UserConfig): string {
  const json = JSON.stringify(config);
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
