import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || '7000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DEBUG: process.env.DEBUG === 'true',
  ENABLE_TEST_BENCH: process.env.ENABLE_TEST_BENCH,
  
  ANIMESALT_BASE_URL: process.env.ANIMESALT_BASE_URL || 'https://animesalt.cx',
  WATCHANIMEWORLD_BASE_URL: process.env.WATCHANIMEWORLD_BASE_URL || 'https://watchanimeworld.one',

  TMDB_API_KEY: process.env.TMDB_API_KEY || 'f3e889e0a792887706d3ed9b9a32c5c9',
  TMDB_READ_TOKEN: process.env.TMDB_READ_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmM2U4ODllMGE3OTI4ODc3MDZkM2VkOWI5YTMyYzVjOSIsIm5iZiI6MTc3OTYzNDQ4NC4zMjYwMDAyLCJzdWIiOiI2YTEzMTEzNGI1MzMyZmFjNGVhOWNmMzMiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.sEskHiguOnMVb9JbfIvDHJv8lN7m3DLVv6vaNKDlC9s',
  TVDB_API_KEY: process.env.TVDB_API_KEY || '79c78886-3d4b-4eee-853c-98e2448f8c21',

  CACHE_TTL_METADATA: parseInt(process.env.CACHE_TTL_METADATA || '3600', 10),
  CACHE_TTL_SCRAPER: parseInt(process.env.CACHE_TTL_SCRAPER || '300', 10),
  CACHE_TTL_STREAM_URL: parseInt(process.env.CACHE_TTL_STREAM_URL || '180', 10),
};
