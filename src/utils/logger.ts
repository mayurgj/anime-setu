type LogCategory = 'HTTP' | 'REQUEST' | 'METADATA' | 'ANIMESALT' | 'PLAYER' | 'STREAM' | 'PROXY' | 'CACHE' | 'CONFIG' | 'ERROR';

function sanitize(data: any): any {
  if (typeof data === 'string') {
    return data
      .replace(/(?:key|token|api_key|authorization)=([^&]+)/gi, '$1=[REDACTED]')
      .replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+/g, '[JWT_REDACTED]')
      .replace(/fireplayer_player=[^;]+/gi, 'fireplayer_player=[REDACTED]');
  }
  if (data && typeof data === 'object') {
    const copy = Array.isArray(data) ? [...data] : { ...data };
    for (const key of Object.keys(copy)) {
      if (/key|token|cookie|auth/i.test(key)) {
        copy[key] = '[REDACTED]';
      } else if (typeof copy[key] === 'object') {
        copy[key] = sanitize(copy[key]);
      }
    }
    return copy;
  }
  return data;
}

export const logger = {
  log(category: LogCategory, message: string, ...args: any[]) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const formattedCategory = `[${category}]`.padEnd(12, ' ');

    if (category === 'ERROR') {
      console.error(`${time} ${formattedCategory} ❌ ${message}`, ...args.map(sanitize));
    } else {
      console.log(`${time} ${formattedCategory} ${message}`, ...args.map(sanitize));
    }
  },

  http(message: string, ...args: any[]) {
    this.log('HTTP', message, ...args);
  },

  request(message: string, ...args: any[]) {
    this.log('REQUEST', message, ...args);
  },

  metadata(message: string, ...args: any[]) {
    this.log('METADATA', message, ...args);
  },

  animesalt(message: string, ...args: any[]) {
    this.log('ANIMESALT', message, ...args);
  },

  player(message: string, ...args: any[]) {
    this.log('PLAYER', message, ...args);
  },

  stream(message: string, ...args: any[]) {
    this.log('STREAM', message, ...args);
  },

  proxy(message: string, ...args: any[]) {
    this.log('PROXY', message, ...args);
  },

  cache(message: string, ...args: any[]) {
    this.log('CACHE', message, ...args);
  },

  config(message: string, ...args: any[]) {
    this.log('CONFIG', message, ...args);
  },

  error(message: string, ...args: any[]) {
    this.log('ERROR', message, ...args);
  },
};
