# 🌉 Anime Setu — Multi-CDN Anime Stremio Add-on

<div align="center">

**Stream Anime Movies & Series in Hindi, Tamil, Telugu, Malayalam, Bengali, Marathi, Kannada, English & Japanese**

[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?logo=github)](https://github.com/mayurgj/anime-setu)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Stremio](https://img.shields.io/badge/Stremio-Addon-7D47B7?logo=stremio)](https://stremio.com)
[![Status](https://img.shields.io/badge/Status-Online-00D26A)](#)

</div>

---

## ✨ Features

- ⚡ **Dual Multi-CDN Scanning (Parallel)**:
  - **AnimeSalt** (`animesalt.cx` / `as-cdn26.top`)
  - **AnimeWorld** (`watchanimeworld.one` / `zephyrix.org` / `zn-grid.top`)
- 🇮🇳 **Hindi First Priority & Multi-Audio**:
  - Default **Hindi audio auto-start** with seamless track switching
  - Full Indian regional audio support: *Hindi, Tamil, Telugu, Malayalam, Bengali, Marathi, Kannada*
  - Original global audio tracks: *Japanese, English, Korean*
- 🎬 **Movies & Series Aggregation**:
  - Fast resolution for Anime Movies and TV/Anime Series
  - Intelligent absolute episode numbering & multi-season mapping (e.g. *Naruto Shippuden* S8E12 → Ep 163)
  - Reverse-engineered metadata matching via TMDB, TVDB, and IMDb IDs
- 🛡️ **HLS Stream & Segment Proxy**:
  - Deobfuscates signed token master playlists (`master.m3u8?md5=...&expires=...`)
  - Intercepts and unmasks disguised `.js`/`.css` segment chunks to standard `video/mp2t`
  - Dynamic Referer header forwarding (`https://play.zephyrix.org/`, `https://animesalt.cx/`)
- 🎛️ **Web Configuration Dashboard**:
  - **Quality Filter**: 1080P FHD, 720P HD, 480P SD, 360P Mobile
  - **Audio Routing**: Choose preferred default audio language
  - **Stream Limits**: Set maximum returned stream candidates
  - **1-Click Stremio Install** & Manifest URL generator
- 🔒 **Confidential Developer Test Bench**:
  - Built-in live resolver with instant presets (Naruto, Shinchan, etc.)
  - Source selector (`All Sources`, `AnimeSalt`, `AnimeWorld`)
  - Integrated HLS.js player with dynamic resolution and audio track selector
  - Hidden by default in production; unlockable via secret URL parameter: `?key=animesetu`

---

## 🚀 Live Public Deployment

* **Add-on Configuration Hub**: [https://061949f7032e-animesetu.baby-beamup.club/](https://061949f7032e-animesetu.baby-beamup.club/)
* **Stremio Manifest URL**: `https://061949f7032e-animesetu.baby-beamup.club/manifest.json`
* **1-Click Stremio Install**: `stremio://061949f7032e-animesetu.baby-beamup.club/manifest.json`

---

## 🛠️ Technology Stack

- **Runtime**: Node.js (v20+ LTS)
- **Language**: TypeScript (ES2022)
- **Framework**: Express, CORS
- **Scrapers**: Axios, Cheerio
- **Package Manager**: `pnpm` / `npm`
- **Testing**: Vitest (23 Unit & Integration Tests)
- **Deployment**: Beamup (Dokku / Herokuish buildpack)

---

## 💻 Local Development Setup

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/mayurgj/anime-setu.git
cd anime-setu
pnpm install
```

### 2. Configure Environment

Copy the example environment configuration:

```bash
cp .env.example .env
```

Edit `.env` to configure your API keys:

```env
PORT=7000
NODE_ENV=development
DEBUG=true

# Metadata API Keys
TMDB_API_KEY=your_tmdb_api_key
TMDB_READ_TOKEN=your_tmdb_read_token
TVDB_API_KEY=your_tvdb_api_key

# Scraper Endpoints
ANIMESALT_BASE_URL=https://animesalt.cx
WATCHANIMEWORLD_BASE_URL=https://watchanimeworld.one
```

### 3. Start Development Server

```bash
pnpm dev
```

The server will start on `http://localhost:7000/`.

---

## 🧪 Testing

Run the Vitest test suite (23 offline & live integration tests):

```bash
# Run all tests
pnpm test

# Build TypeScript to dist
pnpm build
```

---

## 📡 API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/` | `GET` | Configuration Dashboard & Stremio Installation Hub |
| `/manifest.json` | `GET` | Stremio Add-on Manifest |
| `/:config/manifest.json` | `GET` | User-configured Stremio Add-on Manifest |
| `/stream/:type/:id.json` | `GET` | Stream resolver endpoint (`type`: `movie` or `series`, `id`: IMDb, TMDB, or slug) |
| `/:config/stream/:type/:id.json` | `GET` | Stream resolver endpoint with user-selected configuration |
| `/proxy/hls` | `GET` | HLS Master playlist and segment unmasking proxy |
| `/api/app-info` | `GET` | Environment status and deployment detector |

---

## 🚢 Deploying to Beamup

1. **Install Beamup CLI**:
   ```bash
   npm install beamup-cli -g
   ```

2. **Configure your GitHub account & host**:
   ```bash
   beamup config
   # Host: a.baby-beamup.club
   # GitHub username: mayurgj
   ```

3. **Deploy**:
   ```bash
   beamup
   # Or push directly: git push beamup master
   ```

---

## 📄 License

MIT License. Designed and built with ❤️ for the anime streaming community.
