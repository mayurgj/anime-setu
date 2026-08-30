import axios, { AxiosInstance } from 'axios';
import { logger } from './logger.js';

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export interface HttpClientOptions {
  baseURL?: string;
  referer?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  validateStatus?: (status: number) => boolean;
}

export function createHttpClient(options: HttpClientOptions = {}): AxiosInstance {
  const instance = axios.create({
    baseURL: options.baseURL,
    timeout: options.timeoutMs || 15000,
    maxRedirects: 5,
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      ...(options.referer ? { Referer: options.referer } : {}),
      ...options.headers,
    },
    validateStatus: options.validateStatus || ((status) => status >= 200 && status < 400),
  });

  instance.interceptors.request.use((config) => {
    logger.request(`${config.method?.toUpperCase()} ${config.baseURL || ''}${config.url || ''}`);
    return config;
  });

  instance.interceptors.response.use(
    (response) => {
      logger.request(
        `Response ${response.status} from ${response.config.baseURL || ''}${response.config.url || ''}`
      );
      return response;
    },
    (error) => {
      if (error.response) {
        logger.error(
          `Request failed with status ${error.response.status}: ${error.config?.url || ''}`
        );
      } else {
        logger.error(`Network error: ${error.message}`);
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

export function isAllowedDomain(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();
    
    // Check for as-cdn*.top (e.g. as-cdn26.top, as-cdn27.top, as-cdn28.top)
    if (/^as-cdn\d+\.top$/.test(hostname)) {
      return true;
    }

    // Check for *.zn-grid*.top or zn-grid*.top (e.g. s11.zn-grid01.top, s11.zn-grid02.top, etc.)
    if (/^(?:[a-z0-9-]+\.)*zn-grid\d+\.top$/.test(hostname)) {
      return true;
    }

    const allowedRoots = [
      'animesalt.cx',
      'watchanimeworld.one',
      'watchanimeworld.top',
      'watchanimeworld.cc',
      'watchanimeworld.net',
      'zephyrix.org',
      'firevideoplayer.com',
      'tmdb.org',
      'themoviedb.org',
      'thetvdb.com'
    ];

    return allowedRoots.some(
      (root) => hostname === root || hostname.endsWith(`.${root}`)
    );
  } catch {
    return false;
  }
}
