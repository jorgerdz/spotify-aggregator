# Architectural Decision Log

Record of key decisions made during planning and implementation.

---

## ADR-001: Cloudflare Workers + Pages over traditional server

**Context:** The original app ran as a local Express server. Need to choose deployment target.

**Decision:** Cloudflare Workers for API, Cloudflare Pages for frontend.

**Rationale:**
- Jorge already has Cloudflare Workers experience
- No server management, scales automatically
- KV provides simple persistence without provisioning a database
- Pages + Workers share the same platform, simplifying deployment
- Free tier is generous for a personal/small-user-base tool

**Trade-offs:**
- Can't use `spotify-web-api-node` (requires Node.js runtime)
- Workers have 10ms CPU time on free plan (50ms on paid) — pagination of large libraries may need care
- KV is eventually consistent (acceptable for this use case)

---

## ADR-002: Direct fetch over spotify-web-api-node

**Context:** Original code uses `spotify-web-api-node`. Workers run V8 isolates, not Node.js.

**Decision:** Build a thin Spotify API client using `fetch`.

**Rationale:**
- Spotify's REST API is clean and well-documented
- Only using ~5 endpoints — no need for a full SDK
- Full control over request/response handling
- TypeScript types give us the safety the SDK would have provided

---

## ADR-003: Spotify as sole identity provider

**Context:** Need to decide whether to build a custom account system.

**Decision:** Spotify OAuth is the only auth mechanism. Spotify user ID = app user ID.

**Rationale:**
- Every user of this app is a Spotify user by definition
- Eliminates signup friction, password management, email verification
- Refresh tokens stored in KV provide "remember me" functionality
- No need for a users table or account management UI

---

## ADR-004: KV over D1 for persistence

**Context:** Need to store refresh tokens and optionally saved patterns.

**Decision:** Start with Cloudflare KV. Migrate to D1 only if relational queries become necessary.

**Rationale:**
- Data model is simple: `user_id → token`, `user_id → [patterns]`
- KV is simpler to set up and reason about
- No schema migrations to manage
- Can always migrate to D1 later for history/analytics features

---

## ADR-005: TypeScript rewrite over JavaScript port

**Context:** Original code is JavaScript. Could either port it directly or rewrite in TypeScript.

**Decision:** Full TypeScript for both frontend and Worker.

**Rationale:**
- Spotify API responses are complex nested objects — types prevent bugs
- Modern tooling (Vite, Hono, Wrangler) all have first-class TS support
- The core logic is small (~100 lines) so rewriting cost is low
- Better IDE experience for future development

---

## ADR-006: Hono as Worker framework

**Context:** Need routing and middleware in the Worker. Options: raw Worker API, itty-router, Hono.

**Decision:** Use Hono.

**Rationale:**
- Purpose-built for edge runtimes (Workers, Deno, Bun)
- Familiar Express-like API
- Built-in middleware for CORS, auth, etc.
- Typed context and request/response
- Active maintenance and good documentation

---

## ADR-007: Monorepo with workspaces

**Context:** Two packages (frontend + API). Could be separate repos or a monorepo.

**Decision:** Single repo with npm/pnpm workspaces.

**Rationale:**
- Shared TypeScript types between frontend and API
- Single PR for features that touch both layers
- Simpler CI/CD setup
- Small enough project that monorepo overhead is minimal
