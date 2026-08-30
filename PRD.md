# Build a Local Stremio AnimeSalt Scraper Add-on in Node.js

You are an expert Node.js developer specializing in Stremio add-ons, web scraping, HTML parsing, HTTP debugging, and media-stream extraction.

Build a **locally runnable Stremio add-on** that scrapes **https://animesalt.cx/** and exposes its available streams to Stremio.

The add-on must support:

1. Movies
2. TV/anime series episodes
3. TMDB/TVDB metadata-based matching
4. AnimeSalt URL generation
5. Extraction of playable stream URLs from the AnimeSalt player
6. Proper Stremio `stream` endpoint responses
7. Local development and testing

Do not build a frontend application. This should primarily be a **Node.js Stremio HTTP add-on**.

---

## 1. Technology Requirements

Use:

- Node.js
- JavaScript or TypeScript
- Express
- Axios or native `fetch`
- Cheerio for HTML parsing
- Stremio Add-on SDK
- dotenv
- A robust logging solution or structured console logging

Prefer TypeScript if it does not unnecessarily complicate the implementation.

Use `pnpm` for package management.

The project must run locally with:

```bash
pnpm install
pnpm dev
```

and expose the add-on on:

```text
http://localhost:7000
```

Make the port configurable through `.env`.

---

# 2. Environment Variables

Create:

```text
.env
```

with:

```env
PORT=7000

TMDB_API_KEY=
TVDB_API_KEY=

ANIMESALT_BASE_URL=https://animesalt.cx
```

Never hard-code API keys.

Create:

```text
.env.example
```

containing placeholders only.

---

# 3. AnimeSalt URL Patterns

AnimeSalt uses the following URL structures.

## Movies

Example:

```text
https://animesalt.cx/movies/shinchan-movie-the-spicy-kasukabe-dancers/
```

Pattern:

```text
https://animesalt.cx/movies/{{slug}}/
```

Where `{{slug}}` is the AnimeSalt-compatible slug.

---

## Series Episodes

Example:

```text
https://animesalt.cx/episode/naruto-shippuden-2x33/
```

Pattern:

```text
https://animesalt.cx/episode/{{title}}-{{season}}x{{episode}}/
```

Important interpretation:

```text
naruto-shippuden-2x33
```

means:

```text
title   = naruto-shippuden
season  = 2
episode = 33
```

Another example:

```text
naruto-shippuden-3x54
```

means:

```text
title   = naruto-shippuden
season  = 3
episode = 54
```

Build this parsing/generation logic as reusable utility functions.

---

# 4. Metadata Matching

Stremio will provide IMDb/TMDB/TVDB IDs depending on the catalog/metadata source.

Use TMDB and TVDB APIs to reliably determine:

- canonical title
- alternative/original title
- release year
- season
- episode
- episode title
- media type

The goal is to convert Stremio's requested metadata into an AnimeSalt URL.

Do not blindly use the incoming title.

For example:

```text
Naruto: Shippuden
```

may need to resolve to:

```text
naruto-shippuden
```

before creating:

```text
https://animesalt.cx/episode/naruto-shippuden-2x33/
```

Implement a normalized title/slug pipeline.

---

# 5. Title Normalization

Create a dedicated utility:

```text
src/utils/slug.ts
```

Implement robust normalization:

- lowercase
- trim whitespace
- normalize Unicode
- remove/replace punctuation
- convert whitespace to `-`
- collapse consecutive hyphens
- remove unsafe URL characters

Example:

```text
Naruto: Shippuden
```

→

```text
naruto-shippuden
```

However, do NOT assume that a generic slug always matches AnimeSalt.

The scraper should support alternate title candidates.

For example:

```text
[
  normalizedEnglishTitle,
  originalTitle,
  alternativeTitle1,
  alternativeTitle2
]
```

Try candidates until a valid AnimeSalt page is found.

---

# 6. Movie Flow

Implement:

```text
GET /stream/movie/:id.json
```

The flow should be:

```text
Stremio request
      ↓
Parse movie ID
      ↓
Resolve TMDB/TVDB metadata
      ↓
Generate candidate AnimeSalt slugs
      ↓
Try:
https://animesalt.cx/movies/{{slug}}/
      ↓
Check HTTP response
      ↓
Parse page
      ↓
Find embedded player / streaming source
      ↓
Resolve actual stream URL
      ↓
Return Stremio stream objects
```

Support:

```text
480p
720p
1080p
```

when the source exposes such information.

Do not invent a resolution when it cannot be established.

---

# 7. Series Flow

Implement:

```text
GET /stream/series/:id.json
```

Stremio series requests commonly contain season/episode information.

Parse:

```text
series ID
season
episode
```

Then resolve metadata and construct:

```text
https://animesalt.cx/episode/{{slug}}-{{season}}x{{episode}}/
```

Example:

```text
title:
Naruto Shippuden

season:
2

episode:
33
```

Candidate URL:

```text
https://animesalt.cx/episode/naruto-shippuden-2x33/
```

The supplied AnimeSalt capture confirms that this URL returns HTTP 200.

---

# 8. IMPORTANT: Do Not Stop at the AnimeSalt HTML Page

The main challenge is stream extraction.

The AnimeSalt page contains an embedded/secondary player rather than simply exposing the final media URL in an obvious `<video>` tag.

The supplied captures show that the player uses:

```text
https://as-cdn26.top
```

and references:

```text
/player/assets/scripts.php?v=7
```

The player page defines:

```text
player_base_url = "https://as-cdn26.top"
```

and has a streaming/player architecture around that host.

Therefore:

**Do not merely scrape `<video src="">`.**

Analyze:

- iframe URLs
- embedded player URLs
- scripts
- JavaScript variables
- AJAX/network endpoints
- player initialization
- hidden attributes
- data attributes
- HLS/DASH URLs
- media API endpoints

The supplied HAR files and response captures are the primary reverse-engineering references.

---

# 9. Use the Supplied HAR/Response Files

Inspect all supplied files before implementing the scraper:

```text
series_animesalt.cx.har
movie_animesalt.cx.har

animesalt_movie_response.txt
animesalt_series_response.txt

animesalt_movie_headers.txt
animesalt_series_headers.txt

animesalt_movie_stream_url_reponse.txt
animesalt_series_stream_url_reponse.txt

animesalt_movie_stream_url_headers.txt
animesalt_series_stream_url_headers.txt
```

Treat these files as network-debugging evidence.

Determine precisely:

1. AnimeSalt page request
2. Embedded player request
3. Stream/player request
4. Final media endpoint
5. Required headers
6. Required cookies
7. Referer requirements
8. Whether the returned media is HLS, DASH, MP4, or another format
9. Whether the stream URL is stable or dynamically generated
10. Whether URL expiration/signatures are present

Do not guess the extraction mechanism when it can be determined from the captures.

---

# 10. Player / Stream Extraction

Build a dedicated module:

```text
src/scrapers/animesalt/player.ts
```

It should accept:

```ts
interface PlayerResult {
  streams: StreamCandidate[];
}
```

and handle the complete player resolution chain.

Example architecture:

```text
AnimeSalt page
       ↓
extract iframe/player URL
       ↓
request player
       ↓
inspect player HTML
       ↓
extract media/player ID
       ↓
request stream endpoint
       ↓
parse response
       ↓
identify media URL
       ↓
normalize into StreamCandidate
```

Do not use a browser automation framework unless the supplied captures prove that JavaScript execution is required.

Prefer direct HTTP requests.

Only fall back to Playwright when absolutely necessary.

---

# 11. Headers and Cookies

The supplied requests show that the AnimeSalt page and player may use request metadata such as:

```text
Referer
User-Agent
Accept
Cookie
```

For example, the captured stream request uses:

```text
Referer: https://animesalt.cx/
```

and the player host is:

```text
as-cdn26.top
```

The stream response is HTTP 200 and identifies itself as:

```text
Fire HLS Player
```

in the captured response. 
Implement a centralized HTTP client that supports:

```ts
createHttpClient()
```

with:

- configurable User-Agent
- Referer
- cookies
- timeout
- redirects
- response logging in debug mode

Do not hard-code cookies obtained from the HAR because they may be session-specific or temporary.

Instead, reproduce the request flow that obtains them.

---

# 12. Stremio Stream Response

Return valid Stremio stream objects.

Example conceptual response:

```json
{
  "streams": [
    {
      "name": "AnimeSalt",
      "title": "Hindi • 1080p",
      "url": "https://..."
    }
  ]
}
```

If applicable, include:

```json
{
  "name": "AnimeSalt",
  "title": "Hindi • 1080p",
  "url": "...",
  "behaviorHints": {
    "bingeGroup": "animesalt-hindi"
  }
}
```

Use correct Stremio add-on conventions.

Do not return placeholder URLs.

---

# 13. Language Detection

AnimeSalt pages may provide multiple audio languages.

The supplied player HTML defines language values including:

```text
hin
tam
tel
ben
mal
mar
kan
eng
kor
jpn
und
```

and default caption mappings.

Parse language information when it is actually available.

Normalize:

```text
hin → Hindi
tam → Tamil
tel → Telugu
ben → Bengali
mal → Malayalam
mar → Marathi
kan → Kannada
eng → English
kor → Korean
jpn → Japanese
```

Return language-aware stream titles such as:

```text
Hindi • 1080p
Marathi • 720p
Japanese • 1080p
```

Do not claim that a stream is in a language unless the source/player metadata supports it.

---

# 14. Resolution Detection

Detect:

```text
2160p
1440p
1080p
720p
576p
480p
360p
240p
144p
Unknown
```

Map detected source information into Stremio-friendly titles.

Example:

```text
Hindi • 1080p
Hindi • 720p
Hindi • 480p
```

If the player only exposes one adaptive HLS stream with multiple variants, inspect the manifest and expose it appropriately instead of creating duplicate URLs.

---

# 15. HLS/DASH Handling

If the final stream is:

```text
.m3u8
```

return the URL as an HLS stream.

If:

```text
.mpd
```

return it as DASH.

If the final URL points to an HTML player rather than the actual media manifest, continue resolving it.

Never return the intermediate player page as the media URL unless that is explicitly the only mechanism supported by Stremio.

---

# 16. Stream Metadata

Create:

```ts
interface StreamCandidate {
  url: string;
  title?: string;
  name?: string;
  language?: string;
  quality?: string;
  type?: "hls" | "dash" | "mp4" | "unknown";
  headers?: Record<string, string>;
}
```

Then convert candidates to Stremio stream objects.

---

# 17. Caching

Implement lightweight in-memory caching.

Cache:

```text
metadata lookups
AnimeSalt URL discovery
resolved stream URLs
```

Use a TTL.

Suggested defaults:

```text
metadata: 1 hour
AnimeSalt page: 5 minutes
stream URL: 2-5 minutes
```

Do not cache sensitive cookies indefinitely.

Make TTL configurable.

---

# 18. Error Handling

The add-on must never crash because an individual movie/episode cannot be found.

Handle:

```text
404
403
429
500
timeout
invalid HTML
missing iframe
missing player
missing media URL
TMDB failure
TVDB failure
AnimeSalt layout changes
```

Return:

```json
{
  "streams": []
}
```

when no stream can safely be resolved.

Log the actual error server-side.

Do not expose API keys or sensitive request headers.

---

# 19. Debug Logging

Add:

```env
DEBUG=true
```

When enabled, log:

```text
[REQUEST]
[METADATA]
[ANIMESALT]
[PLAYER]
[STREAM]
[CACHE]
[ERROR]
```

Example:

```text
[ANIMESALT] URL:
https://animesalt.cx/episode/naruto-shippuden-2x33/

[ANIMESALT] Status: 200

[PLAYER] Found iframe:
...

[STREAM] Found media URL:
...

[STREAM] Type: HLS

[STREAM] Language: Hindi

[STREAM] Quality: 1080p
```

Never log:

```text
TMDB API key
TVDB API key
authentication tokens
session cookies
signed private credentials
```

---

# 20. Project Structure

Use a clean structure similar to:

```text
animesalt-stremio-addon/
│
├── src/
│   ├── index.ts
│   ├── addon.ts
│   │
│   ├── config/
│   │   └── env.ts
│   │
│   ├── metadata/
│   │   ├── tmdb.ts
│   │   ├── tvdb.ts
│   │   └── resolver.ts
│   │
│   ├── scrapers/
│   │   └── animesalt/
│   │       ├── index.ts
│   │       ├── movie.ts
│   │       ├── series.ts
│   │       ├── player.ts
│   │       └── parser.ts
│   │
│   ├── streams/
│   │   ├── resolver.ts
│   │   ├── parser.ts
│   │   └── types.ts
│   │
│   ├── utils/
│   │   ├── slug.ts
│   │   ├── http.ts
│   │   ├── cache.ts
│   │   └── logger.ts
│   │
│   └── routes/
│       └── stream.ts
│
├── tests/
│   ├── slug.test.ts
│   ├── animesalt-movie.test.ts
│   ├── animesalt-series.test.ts
│   └── player.test.ts
│
├── fixtures/
│   └── animesalt/
│
├── .env
├── .env.example
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── README.md
```

---

# 21. Separate Metadata From Scraping

Do not mix TMDB/TVDB logic with AnimeSalt scraping.

The architecture should be:

```text
Stremio Request
      ↓
Metadata Resolver
      ↓
Normalized Media Identity
      ↓
AnimeSalt Resolver
      ↓
Player Resolver
      ↓
Stream Parser
      ↓
Stremio Stream Objects
```

For example:

```ts
interface MediaIdentity {
  type: "movie" | "series";
  title: string;
  originalTitle?: string;
  year?: number;

  season?: number;
  episode?: number;

  tmdbId?: string;
  tvdbId?: string;
  imdbId?: string;
}
```

---

# 22. Test Cases

The implementation must include tests for at least:

## Movie

Input:

```text
title = Shinchan Movie: The Spicy Kasukabe Dancers
```

Expected candidate:

```text
https://animesalt.cx/movies/shinchan-movie-the-spicy-kasukabe-dancers/
```

The supplied capture confirms that this AnimeSalt movie page returns HTTP 200.

---

## Series

Input:

```text
title = Naruto Shippuden
season = 2
episode = 33
```

Expected:

```text
https://animesalt.cx/episode/naruto-shippuden-2x33/
```

The supplied capture confirms that this page returns HTTP 200.

---

## Series slug parsing

Input:

```text
naruto-shippuden-2x33
```

Expected:

```json
{
  "title": "naruto-shippuden",
  "season": 2,
  "episode": 33
}
```

Input:

```text
naruto-shippuden-3x54
```

Expected:

```json
{
  "title": "naruto-shippuden",
  "season": 3,
  "episode": 54
}
```

---

# 23. Local Testing API

Create a simple health endpoint:

```text
GET /
```

Response:

```json
{
  "name": "AnimeSalt Stremio Add-on",
  "status": "ok"
}
```

Create an add-on manifest endpoint:

```text
GET /manifest.json
```

It must return a valid Stremio add-on manifest.

Then support stream testing manually.

Example:

```text
GET /stream/movie/<id>.json
```

and:

```text
GET /stream/series/<id>/<season>/<episode>.json
```

Adapt the exact route structure to the Stremio SDK conventions you use.

---

# 24. Development Debug Endpoint

Add a development-only endpoint:

```text
GET /debug/animesalt/movie?slug=...
```

and:

```text
GET /debug/animesalt/episode?slug=...&season=...&episode=...
```

This endpoint should return structured debugging information such as:

```json
{
  "sourceUrl": "...",
  "status": 200,
  "playerUrl": "...",
  "streamCandidates": [],
  "errors": []
}
```

Only enable these routes when:

```env
DEBUG=true
```

---

# 25. Fixture-Based Testing

Use the supplied HAR and HTML/text captures to create local fixtures.

The tests should not require the real AnimeSalt website for basic parser tests.

Create fixtures for:

```text
movie page
series page
player page
stream response
headers
```

Then test:

```text
HTML parsing
iframe extraction
player extraction
stream URL extraction
language detection
resolution detection
```

This protects the scraper from regressions.

---

# 26. Real Website Integration Tests

Also provide optional integration tests:

```bash
pnpm test:integration
```

These should access the live AnimeSalt website.

Do not make ordinary unit tests depend on the live site.

Integration tests should fail gracefully when the site is unreachable.

---

# 27. Important Reverse-Engineering Rule

The supplied HAR captures are authoritative for implementing the current AnimeSalt request chain.

Before writing the player resolver:

1. Examine the HAR.
2. Identify the exact request that transitions from AnimeSalt into the player.
3. Identify the request that produces the `/video/...` resource.
4. Inspect the response body of that resource.
5. Determine whether it contains an HLS URL, playlist information, or another player configuration.
6. Reproduce only the necessary request sequence in Node.js.
7. Avoid browser automation when direct HTTP reproduction works.

The captured stream request currently has the form:

```text
https://as-cdn26.top/video/<id>
```

with HTTP 200 and `content-type: text/html`.

That means this `/video/<id>` URL should **not automatically be assumed to be the final playable media URL**. Inspect its response and follow the player logic until the actual media resource is identified.

---

# 28. Robustness Against AnimeSalt Changes

Centralize all AnimeSalt-specific selectors and assumptions.

Do not scatter selectors throughout the code.

For example:

```ts
const selectors = {
  iframe: [...],
  player: [...],
  language: [...],
  quality: [...],
};
```

Create fallback extraction methods where practical.

The scraper should tolerate:

- WordPress HTML changes
- different iframe attributes
- additional player wrappers
- reordered scripts
- changed CSS classes

without requiring a complete rewrite.

---

# 29. Security

Never:

- commit `.env`
- expose API keys
- expose cookies
- expose authorization headers
- log signed URLs unnecessarily
- trust arbitrary user-supplied URLs for server-side fetching

Validate incoming IDs and parameters.

Restrict scraper requests to expected domains:

```text
animesalt.cx
as-cdn26.top
```

or other domains explicitly discovered and required by the captured request flow.

Avoid SSRF vulnerabilities.

---

# 30. README

Create a complete README containing:

## Installation

```bash
pnpm install
```

## Configuration

```bash
cp .env.example .env
```

Add:

```text
TMDB_API_KEY
TVDB_API_KEY
```

## Development

```bash
pnpm dev
```

## Testing

```bash
pnpm test
```

## Integration Testing

```bash
pnpm test:integration
```

## Stremio Installation

Explain how to install the local add-on using:

```text
http://localhost:7000/manifest.json
```

Also explain how to use the local add-on from another device on the same LAN, including the machine's LAN IP.

Example:

```text
http://192.168.x.x:7000/manifest.json
```

---

# 31. Acceptance Criteria

The project is complete only when all of the following work:

### Movie

Given:

```text
Shinchan Movie: The Spicy Kasukabe Dancers
```

the add-on can resolve the AnimeSalt movie page and attempt to obtain a playable stream.

### Series

Given:

```text
Naruto Shippuden
Season 2
Episode 33
```

the add-on can resolve:

```text
https://animesalt.cx/episode/naruto-shippuden-2x33/
```

and attempt to obtain a playable stream.

### Stremio

The manifest installs successfully into Stremio.

The stream endpoint returns valid Stremio JSON.

### Extraction

The implementation follows the actual AnimeSalt → player → stream request chain discovered from the supplied HAR files instead of relying on hard-coded example stream URLs.

### Reliability

A missing AnimeSalt page returns:

```json
{
  "streams": []
}
```

rather than crashing the add-on.

---

# 32. Implementation Workflow

Follow this order:

### Phase 1
Inspect all supplied HAR/HTML/header/response files.

### Phase 2
Document the exact AnimeSalt request chain discovered in those files.

### Phase 3
Build the HTTP client and low-level parsers.

### Phase 4
Build AnimeSalt movie scraper.

### Phase 5
Build AnimeSalt episode scraper.

### Phase 6
Build player/stream resolver.

### Phase 7
Build TMDB/TVDB metadata resolver.

### Phase 8
Connect everything to Stremio SDK.

### Phase 9
Add tests and fixtures.

### Phase 10
Run local integration tests.

### Phase 11
Verify:

```text
http://localhost:7000/manifest.json
```

and test the add-on from Stremio.

---

# 33. Final Agent Behavior

Do not stop after creating boilerplate.

Actually implement the scraper.

Do not leave placeholders such as:

```text
TODO: implement scraper
TODO: extract stream
TODO: parse player
```

Where reverse engineering is necessary, inspect the supplied files first and implement the request chain evidenced by them.

At the end, provide:

1. Complete project files
2. Installation commands
3. `.env.example`
4. Test commands
5. Local Stremio installation URL
6. Example test requests
7. A short explanation of the discovered AnimeSalt stream-resolution flow
8. Any remaining limitation where the supplied evidence is insufficient

Do not invent undocumented AnimeSalt APIs or stream endpoints.