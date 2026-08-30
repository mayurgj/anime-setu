# AnimeSalt Stremio Add-on

A locally runnable Node.js & TypeScript Stremio HTTP add-on that scrapes [AnimeSalt](https://animesalt.cx/) and exposes its available streams directly to Stremio.

Supports:
- 🎬 Movies (e.g. *Shinchan Movie: The Spicy Kasukabe Dancers*)
- 📺 TV/Anime series episodes (e.g. *Naruto Shippuden* S2E33)
- 🌐 Multi-language audio (Hindi, Tamil, Telugu, Malayalam, Kannada, Bengali, English, Japanese, etc.)
- 🎯 TMDB / TVDB / IMDb metadata resolution and intelligent title slug generation
- ⚡ Fast in-memory caching with configurable TTLs
- 🔍 Pure direct HTTP stream extraction without heavy headless browser automation

---

## 🛠️ Technology Stack

- **Runtime**: Node.js (v18+)
- **Language**: TypeScript (ES2022)
- **Framework**: Express
- **Scraping / Parsing**: Axios, Cheerio
- **Package Manager**: `pnpm`
- **Testing**: Vitest

---

## 🔬 Discovered Stream Resolution Flow

Based on network reverse-engineering and HAR analysis:

```
1. AnimeSalt Page Request:
   GET https://animesalt.cx/movies/{slug}/
   OR  https://animesalt.cx/episode/{slug}-{season}x{episode}/
   → Parse HTML for player iframe: <iframe src="https://as-cdn26.top/video/{hash}">

2. Player Page & Cookie Handshake:
   GET https://as-cdn26.top/video/{hash} (with Referer: https://animesalt.cx/)
   → Captures session cookie `fireplayer_player`
   → Deobfuscates Dean Edwards packed JS `eval(function(p,a,c,k,e,d)...)` to extract video title, languages, and quality hints

3. Stream Source Retrieval:
   POST https://as-cdn26.top/player/index.php?data={hash}&do=getVideo
   Body: hash={hash}&r=https://animesalt.cx/
   Headers: Cookie, Referer, X-Requested-With
   → Returns JSON containing the direct HLS `.m3u8` master playlist URL:
     `https://as-cdn26.top/cdn/hls/{id}/master.m3u8?md5={token}&expires={timestamp}`

4. Stremio Stream Response:
   Exposes the playable HLS stream with proper title, binge groups, and proxy headers.
```

---

## 🚀 Getting Started

### 1. Installation

Clone this repository and install dependencies with `pnpm`:

```bash
pnpm install
```

### 2. Configuration

Create your local `.env` file from the provided template:

```bash
cp .env.example .env
```

Edit `.env` (or `.env.local`) and configure your API keys:

```env
PORT=7000

TMDB_API_KEY=your_tmdb_api_key
TMDB_READ_TOKEN=your_tmdb_read_token
TVDB_API_KEY=your_tvdb_api_key

ANIMESALT_BASE_URL=https://animesalt.cx
ANIMESALT_CDN_URL=https://as-cdn26.top

DEBUG=true

# Cache TTLs (in seconds)
CACHE_TTL_METADATA=3600
CACHE_TTL_ANIMESALT_PAGE=300
CACHE_TTL_STREAM_URL=180
```

---

## 💻 Running the Add-on

### Development Mode

Runs the TypeScript source files with auto-reload:

```bash
pnpm dev
```

### Production Build & Run

```bash
pnpm build
pnpm start
```

The server starts on port `7000` (or the configured `PORT`).

---

## 🧪 Testing

### Unit Tests (Fixture-based, offline)

```bash
pnpm test
```

Runs all 5 test suites covering:
- Title slug normalization & series slug parsing
- Dean Edwards packed JavaScript deobfuscation
- HTML parser & iframe selector extractors
- Stremio stream resolution

### Live Integration Tests

```bash
pnpm test:integration
```

Performs live end-to-end tests scraping real movie and series streams from AnimeSalt.

---

## 📺 Stremio Installation

### 1. Same Device (Desktop)

1. Start the add-on server (`pnpm dev` or `pnpm start`).
2. Open Stremio.
3. Go to **Add-ons** → **Community Add-ons** (or search bar).
4. Paste the local manifest URL:
   ```text
   http://localhost:7000/manifest.json
   ```
5. Click **Install**.

### 2. Other Devices on Local Network (Android TV, Mobile, Fire TV, Tablet)

1. Find your computer's local IP address (e.g. `192.168.1.50`). The server will automatically print your LAN URLs on startup.
2. Open Stremio on your target device (connected to the same Wi-Fi).
3. In the add-on search/install field, enter:
   ```text
   http://192.168.x.x:7000/manifest.json
   ```
4. Click **Install**.

---

## 📡 API Endpoints

| Endpoint | Description |
|---|---|
| `GET /` | Health check endpoint |
| `GET /manifest.json` | Stremio add-on manifest |
| `GET /stream/movie/:id.json` | Stremio movie stream endpoint (`:id` can be TMDB ID, IMDb ID, or slug) |
| `GET /stream/series/:id.json` | Stremio series stream endpoint (e.g. `tmdb:31910:2:33.json` or `naruto-shippuden:2:33.json`) |
| `GET /debug/animesalt/movie?slug=...` | Debug endpoint for inspecting movie stream extraction |
| `GET /debug/animesalt/episode?slug=...&season=...&episode=...` | Debug endpoint for inspecting series episode stream extraction |

### Example Debug Requests

```bash
# Health check
curl http://localhost:7000/

# Manifest
curl http://localhost:7000/manifest.json

# Movie Debug
curl "http://localhost:7000/debug/animesalt/movie?slug=shinchan-movie-the-spicy-kasukabe-dancers"

# Episode Debug
curl "http://localhost:7000/debug/animesalt/episode?slug=naruto-shippuden&season=2&episode=33"

# Stremio Movie Stream
curl http://localhost:7000/stream/movie/shinchan-movie-the-spicy-kasukabe-dancers.json

# Stremio Series Stream
curl http://localhost:7000/stream/series/tmdb:31910:2:33.json
```
