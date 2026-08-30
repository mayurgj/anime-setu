import { watchAnimeWorldSeriesScraper } from './series.js';
import { watchAnimeWorldMovieScraper } from './movie.js';
import { zephyrixPlayerResolver } from './player.js';

export const watchAnimeWorldScraper = {
  series: watchAnimeWorldSeriesScraper,
  movie: watchAnimeWorldMovieScraper,
  player: zephyrixPlayerResolver,
};

export {
  watchAnimeWorldSeriesScraper,
  watchAnimeWorldMovieScraper,
  zephyrixPlayerResolver,
};
