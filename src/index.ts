import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { addonManifest } from './addon.js';
import { streamRouter } from './routes/stream.js';
import { proxyRouter } from './routes/proxy.js';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '../public');

const app: express.Express = express();

// Enable CORS for all origins (required by Stremio clients)
app.use(cors());
app.use(express.json());

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});

// Comprehensive Terminal HTTP Request Logger Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusIcon = status < 400 ? '✓' : '⚠️';
    
    // Clean up proxy query for readability in terminal
    let displayUrl = originalUrl;
    if (displayUrl.startsWith('/proxy/hls?url=')) {
      try {
        const decoded = decodeURIComponent(displayUrl.replace('/proxy/hls?url=', ''));
        const isM3u8 = decoded.includes('.m3u8');
        const file = decoded.split('?')[0].split('/').pop();
        displayUrl = `/proxy/hls [${isM3u8 ? 'MANIFEST' : 'SEGMENT'}] -> ${file || decoded.slice(0, 60)}`;
      } catch {}
    }

    logger.http(`${statusIcon} ${method.padEnd(4, ' ')} ${status} ${duration}ms | ${displayUrl}`);
  });

  next();
});

// Serve static assets from public/
app.use(express.static(publicDir));

// App Info / Environment Status
app.get('/api/app-info', (req: Request, res: Response) => {
  const host = (req.get('host') || '').toLowerCase();
  const isBeamup = host.includes('beamup') || process.env.BEAMUP === 'true' || process.env.IS_BEAMUP === 'true';
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
  const isProduction = env.NODE_ENV === 'production' || isBeamup;
  const enableTestBench =
    env.ENABLE_TEST_BENCH === 'true' ||
    (env.ENABLE_TEST_BENCH !== 'false' && !isBeamup && !isProduction);

  res.setHeader('Cache-Control', 'no-cache');
  res.json({
    version: '1.0.0',
    isProduction,
    isBeamup,
    enableTestBench,
  });
});

// Serve Configuration Page on / and /configure
app.get(['/', '/configure', '/:config/configure'], (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Stremio Addon Manifest (both standard and with :config)
app.get(['/manifest.json', '/:config/manifest.json'], (req: Request, res: Response) => {
  const config = req.params.config;
  if (config) {
    logger.config(`Manifest requested with custom config: ${config}`);
  } else {
    logger.config(`Standard manifest requested`);
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'max-age=3600, public');
  res.json(addonManifest);
});

// HLS Stream & Segment Proxy
app.use(proxyRouter);

// Stremio Stream & Debug Routes
app.use(streamRouter);

// Start HTTP server
const server = app.listen(env.PORT, () => {
  console.log(`\n================================================================`);
  console.log(`🚀 ${addonManifest.name} Stremio Add-on is LIVE & LOGGING TO TERMINAL`);
  console.log(`📡 Dashboard & Config:    http://localhost:${env.PORT}/`);
  console.log(`📡 Stremio Manifest URL: http://localhost:${env.PORT}/manifest.json`);

  const networkInterfaces = os.networkInterfaces();
  for (const name of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`📱 LAN Manifest URL:     http://${net.address}:${env.PORT}/manifest.json`);
      }
    }
  }
  console.log(`================================================================\n`);
  logger.http(`Server listening on port ${env.PORT}`);
});

export { app, server };
