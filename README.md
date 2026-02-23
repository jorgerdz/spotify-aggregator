# Spotify Aggregator

A simple web application to bulk merge and manage Spotify playlists using Regular Expressions and ownership filters.

## Production URL
[https://spotify-aggregator.pages.dev/](https://spotify-aggregator.pages.dev/)

## Features
- Login with your Spotify account.
- Filter your playlists (owned or followed) using Regular Expressions (e.g., `/\d{4}/` for year-based playlists).
- Preview the tracks that will be merged.
- Bulk merge the matched playlists into a new or existing playlist.

## Development

This project is structured as a monorepo with a React frontend and a Cloudflare Workers backend.

### Prerequisites
- Node.js (v18+)
- npm
- A Spotify Developer account with a registered application for Client ID and Secret.

### Setup

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables for the backend (e.g., in `apps/api/.dev.vars` or via `wrangler secret put`):
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`

### Running Locally

You will need to run both the frontend and backend development servers.

**Frontend (React/Vite) - runs on port 5173:**
```bash
cd apps/web
npm run dev
```

**Backend (Cloudflare Workers / Hono) - runs on port 8787:**
```bash
cd apps/api
npm run dev
```

## Deployment

The application is deployed to Cloudflare Infrastructure:
- **Frontend**: Cloudflare Pages
- **Backend API**: Cloudflare Workers
- **Session Storage**: Cloudflare KV

 Deployment is currently configured via `wrangler` and standard Cloudflare Pages configuration.
