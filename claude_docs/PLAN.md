# Spotify Playlist Aggregator — Implementation Plan

## Overview

A web application that lets users log in with Spotify, define regex patterns to match playlist names, preview the merged track list, and publish the result to a new or existing playlist. Supports multiple users via Spotify OAuth — no custom account system.

**Core idea:** You have playlists with a naming convention (e.g., `1/26`, `2/26` for monthly playlists). You define a regex, the app finds all matching playlists, merges their tracks, and writes them to a target playlist.

## Architecture

```
┌─────────────────────┐       ┌──────────────────────────┐
│   React Frontend    │◄─────►│   Cloudflare Worker API  │
│  (Cloudflare Pages) │       │                          │
│                     │       │  - OAuth callback        │
│  - Regex input      │       │  - Playlist fetching     │
│  - Playlist preview │       │  - Track merging         │
│  - Track preview    │       │  - Bulk playlist writes  │
│  - Merge confirm    │       │                          │
└─────────────────────┘       └──────────┬───────────────┘
                                         │
                              ┌──────────▼───────────────┐
                              │   Cloudflare KV          │
                              │                          │
                              │  user:{id}:refresh_token │
                              │  user:{id}:patterns      │
                              └──────────┬───────────────┘
                                         │
                              ┌──────────▼───────────────┐
                              │   Spotify Web API        │
                              └──────────────────────────┘
```

### Tech Stack

| Layer        | Technology                     | Rationale                                                        |
| ------------ | ------------------------------ | ---------------------------------------------------------------- |
| Frontend     | React + Vite                   | Familiar, lightweight, fast dev server                           |
| Hosting      | Cloudflare Pages               | Free, fast, integrates with Workers                              |
| Backend API  | Cloudflare Workers (Hono)      | Edge-native, pairs with KV, no server management                 |
| Persistence  | Cloudflare KV                  | Key-value is sufficient — no relational queries needed initially |
| Spotify SDK  | Direct HTTP via `fetch`        | Workers can't use `spotify-web-api-node` (Node.js-only)          |
| Auth         | Spotify OAuth Authorization Code + PKCE | Industry standard, multi-user from day one               |

### Important: Workers Constraints

The existing code uses `spotify-web-api-node` which depends on Node.js built-ins (`fs`, `http`, etc.). Cloudflare Workers run on V8 isolates, not Node.js. We need to either:

1. **Use direct `fetch` calls to Spotify's REST API** (recommended — the API is straightforward)
2. Or find a Workers-compatible Spotify client

The pagination logic (`allPagesBuilder`, `runner`, `bulkRunner`) ports directly — it's just promise orchestration.

## Phases

### Phase 1 — Project Scaffold & Auth

**Goal:** User can click "Login with Spotify" and land back on the app authenticated.

#### Tasks

- [ ] Initialize monorepo structure (see [Project Structure](#project-structure))
- [ ] Set up Cloudflare Worker with Hono
- [ ] Set up React + Vite frontend
- [ ] Register a new Spotify app at [developer.spotify.com](https://developer.spotify.com) with proper redirect URI
- [ ] Implement Spotify OAuth flow:
  - Frontend redirects to Spotify authorize URL
  - Worker handles callback, exchanges code for tokens
  - Store refresh token in KV keyed by Spotify user ID
  - Return access token to frontend (short-lived, in-memory or httpOnly cookie)
- [ ] Implement token refresh: Worker endpoint that uses stored refresh token to get new access token
- [ ] Implement session management: Frontend can check if user is logged in on page load
- [ ] Set up wrangler.toml with KV namespace bindings
- [ ] Configure CORS between Pages and Worker (or use same-origin via Workers routes)

#### Spotify OAuth Scopes Needed

```
playlist-read-private    — read user's private playlists
playlist-modify-private  — create/modify private playlists
playlist-modify-public   — create/modify public playlists
user-library-modify      — (optional, for saving tracks)
```

#### KV Schema (Phase 1)

```
Key: user:{spotify_user_id}:refresh_token
Value: "AQD..."  (the refresh token string)
```

---

### Phase 2 — Playlist Browsing & Regex Matching

**Goal:** User sees all their playlists and can type a regex to filter them in real time.

#### Tasks

- [ ] Build Spotify API client module for Workers (`fetch`-based):
  - `getUserPlaylists(accessToken)` — paginated, returns all playlists
  - Port `runner` / `allPagesBuilder` pagination logic
- [ ] API endpoint: `GET /api/playlists` — returns all playlists for the authenticated user
- [ ] Frontend: Display playlists in a list/grid (name, cover art, track count)
- [ ] Frontend: Regex input field with live filtering
  - As user types, highlight matching playlists
  - Show match count
  - Highlight the matched portion of each playlist name
  - Graceful handling of invalid regex (don't crash, show inline error)
- [ ] Frontend: "Include" / "Exclude" mode toggle (simpler alternative to negative lookaheads)
- [ ] (Optional) Save favorite patterns to KV per user

#### UI Mockup — Regex Matching

```
┌──────────────────────────────────────────────────┐
│  Pattern: [ \d+/\d+                         ]    │
│  Mode: (●) Include  ( ) Exclude                  │
│                                                   │
│  Matching 24 of 87 playlists                      │
│                                                   │
│  ✓  1/26 - January Vibes          (34 tracks)    │
│  ✓  2/26 - February Mix           (28 tracks)    │
│  ✓  3/26 - March Madness          (41 tracks)    │
│  ✓  12/25 - December Wrap         (55 tracks)    │
│  ·  Wilco Greatest Hits           (18 tracks)    │
│  ·  Road Trip 2024                (62 tracks)    │
│  ·  Workout Mix                   (45 tracks)    │
│                                                   │
│  [ Preview Merge → ]                              │
└──────────────────────────────────────────────────┘
```

---

### Phase 3 — Track Preview & Deduplication

**Goal:** Before merging, user sees exactly what tracks will end up in the final playlist.

#### Tasks

- [ ] API endpoint: `POST /api/playlists/tracks` — accepts list of playlist IDs, returns merged track list
  - Port `getPlaylistTracks` pagination logic
  - Strip `available_markets` to reduce payload (as original code does)
- [ ] Frontend: Track preview list showing:
  - Track name, artist, album, duration
  - Source playlist (which playlist contributed this track)
  - Duplicate indicator (same track URI appearing from multiple playlists)
- [ ] Deduplication toggle — on by default, removes duplicate track URIs
- [ ] Filter out local tracks (`spotify:local:*` URIs can't be added via API)
- [ ] Sort options: by source playlist, by date added, alphabetical by title
- [ ] Show total track count and estimated merge size
- [ ] Handle large merges gracefully (500+ tracks) — maybe virtualized list

---

### Phase 4 — Playlist Creation / Update

**Goal:** User confirms the merge and the app writes tracks to Spotify.

#### Tasks

- [ ] API endpoint: `POST /api/merge` — accepts target playlist config + track URIs
  - Port `bulkRunner` logic (chunk into groups of 100, sequential writes)
  - Support creating a new playlist or appending to an existing one
- [ ] Frontend: Merge configuration panel:
  - Create new playlist: name, description, public/private
  - Or select existing playlist from dropdown
  - "Replace" vs "Append" mode for existing playlists
- [ ] Progress indicator during merge (WebSocket or polling for status)
- [ ] Success screen with link to the playlist on Spotify
- [ ] Error handling: partial failures, rate limits, expired tokens mid-merge

#### Rate Limiting Considerations

Spotify enforces rate limits (429 responses with `Retry-After` header). The Worker should:
- Execute chunked writes sequentially (already done in `bulkRunner`)
- Respect `Retry-After` headers
- For multi-user scenarios, consider per-user queuing

---

### Phase 5 — Polish & Quality of Life

**Goal:** Make it feel like a finished product.

#### Tasks

- [ ] Saved patterns: persist user's favorite regex patterns in KV
- [ ] Aggregation history: log past merges (timestamp, pattern, track count, target playlist)
- [ ] Responsive design / mobile support
- [ ] Error boundaries and loading states throughout
- [ ] Proper domain setup (register domain, configure Spotify app redirect)
- [ ] Landing page for logged-out users explaining the tool

#### Future Ideas (not in initial scope)

- Scheduled runs (e.g., "merge my monthly playlists every Sunday" via Cron Triggers)
- Shareable merge configs via link
- Diff view: "these 5 new tracks will be added since last merge"
- Collaborative merges (combine playlists across users)

---

## Project Structure

```
spotify-aggregator/
├── claude_docs/
│   ├── PLAN.md                  ← this file
│   ├── SPOTIFY_API.md           ← Spotify API reference notes
│   └── DECISIONS.md             ← architectural decision log
├── apps/
│   ├── web/                     ← React + Vite frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   ├── pages/
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── api/                     ← Cloudflare Worker
│       ├── src/
│       │   ├── index.ts         ← Hono app entry
│       │   ├── routes/
│       │   │   ├── auth.ts
│       │   │   ├── playlists.ts
│       │   │   └── merge.ts
│       │   ├── spotify/
│       │   │   ├── client.ts    ← fetch-based Spotify API client
│       │   │   ├── pagination.ts ← ported runner/allPagesBuilder
│       │   │   └── types.ts
│       │   └── middleware/
│       │       └── auth.ts      ← verify session, refresh tokens
│       ├── wrangler.toml
│       ├── tsconfig.json
│       └── package.json
├── package.json                 ← workspace root (pnpm/npm workspaces)
└── README.md
```

## Key Design Decisions

### 1. No `spotify-web-api-node` in Workers

Workers don't have Node.js built-ins. The Spotify Web API is REST-based and simple — direct `fetch` calls with proper headers are cleaner and more portable. We'll build a thin typed client.

### 2. Spotify IS the identity provider

No custom accounts, no passwords, no email. Spotify user ID is the primary key. Login = OAuth. Logout = clear session + optionally revoke token.

### 3. KV over D1 (for now)

The data model is simple key-value lookups (refresh tokens, saved patterns). No need for SQL until we want relational queries like aggregation history with filtering. Can migrate to D1 later if needed.

### 4. TypeScript throughout

Both frontend and Worker in TypeScript. The original code is JS but this is a rewrite, not a port — TypeScript catches bugs early, especially around API response shapes.

### 5. Hono for the Worker

Lightweight framework built for edge runtimes. Provides routing, middleware, and typed context without the overhead of Express (which doesn't run on Workers anyway).

## Porting Guide — Original Code → Worker

| Original                        | Worker Equivalent                                   |
| ------------------------------- | --------------------------------------------------- |
| `spotify-web-api-node`          | Direct `fetch` to `https://api.spotify.com/v1/...`  |
| `fs.writeFileSync("token", t)`  | `KV.put("user:{id}:refresh_token", t)`              |
| `fs.readFileSync("token")`      | `KV.get("user:{id}:refresh_token")`                 |
| `express` server for callback   | Hono route `GET /auth/callback`                     |
| `open(authorizeURL)` (CLI)      | Frontend redirect `window.location.href = url`      |
| `runner(method, params)`        | `fetchAllPages(endpoint, accessToken)`               |
| `bulkRunner(method, t, items)`  | `bulkAddTracks(playlistId, uris, accessToken)`       |
| `sequence(promiseFactories)`    | Same pattern — sequential async execution            |
| `split(array, chunk)`           | Same utility — chunk array                           |

## Environment Variables / Secrets

```
SPOTIFY_CLIENT_ID=<from Spotify Developer Dashboard>
SPOTIFY_CLIENT_SECRET=<stored as Worker secret via wrangler secret put>
KV_NAMESPACE=SPOTIFY_AGG  (bound in wrangler.toml)
FRONTEND_URL=https://your-domain.com  (for CORS and redirects)
```

> **Note:** The client ID/secret from the original code are exposed. Register a new Spotify app with proper credentials before deploying.
