export const addonManifest = {
  id: 'org.animesetu.stremio',
  version: '1.0.0',
  name: 'Anime Setu',
  description: 'Bridge to Anime in Hindi, Tamil, Telugu, Malayalam, Bengali, Marathi, Kannada, English & Japanese',
  resources: ['stream'],
  types: ['movie', 'series', 'other'],
  idPrefixes: ['tt', 'tmdb', 'tvdb', 'animesalt', 'animeworld'],
  catalogs: [],
  behaviorHints: {
    configurable: true,
    configurationRequired: false,
  },
};
