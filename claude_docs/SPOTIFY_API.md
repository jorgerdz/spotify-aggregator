# Spotify Web API — Quick Reference

Reference for the endpoints we'll be calling from the Cloudflare Worker.

Base URL: `https://api.spotify.com/v1`

All requests require `Authorization: Bearer {access_token}` header.

---

## Authentication

### Authorization Code Flow with PKCE

1. **Frontend** redirects user to:
   ```
   https://accounts.spotify.com/authorize?
     client_id={CLIENT_ID}&
     response_type=code&
     redirect_uri={REDIRECT_URI}&
     scope={SCOPES}&
     state={RANDOM_STATE}&
     code_challenge_method=S256&
     code_challenge={CODE_CHALLENGE}
   ```

2. **Spotify** redirects back to `{REDIRECT_URI}?code={CODE}&state={STATE}`

3. **Worker** exchanges code for tokens:
   ```
   POST https://accounts.spotify.com/api/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code&
   code={CODE}&
   redirect_uri={REDIRECT_URI}&
   client_id={CLIENT_ID}&
   code_verifier={CODE_VERIFIER}
   ```

   Response:
   ```json
   {
     "access_token": "...",
     "token_type": "Bearer",
     "expires_in": 3600,
     "refresh_token": "...",
     "scope": "..."
   }
   ```

4. **Worker** refreshes expired tokens:
   ```
   POST https://accounts.spotify.com/api/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=refresh_token&
   refresh_token={REFRESH_TOKEN}&
   client_id={CLIENT_ID}
   ```

### Required Scopes

| Scope                      | Used For                              |
| -------------------------- | ------------------------------------- |
| `playlist-read-private`    | Listing user's private playlists      |
| `playlist-modify-private`  | Creating/modifying private playlists  |
| `playlist-modify-public`   | Creating/modifying public playlists   |

---

## Endpoints We Use

### Get Current User's Profile

```
GET /me
```

Returns `id` (Spotify user ID), `display_name`, `images`, etc. Used to identify the user after login.

### Get User's Playlists

```
GET /me/playlists?limit={limit}&offset={offset}
```

- `limit`: max 50
- `offset`: 0-based
- Response includes `total` for pagination
- Returns: `items[]` with `id`, `name`, `images`, `tracks.total`, `owner`, `public`

### Get Playlist Tracks

```
GET /playlists/{playlist_id}/tracks?limit={limit}&offset={offset}
```

- `limit`: max 50 (was 100, changed to 50 in recent API versions)
- Returns: `items[]` with `track.uri`, `track.name`, `track.artists`, `track.album`, `added_at`
- **Note:** `track` can be `null` for local/unavailable tracks

### Create Playlist

```
POST /users/{user_id}/playlists
Content-Type: application/json

{
  "name": "Aggregated Playlist",
  "description": "Merged from: 1/26, 2/26, 3/26...",
  "public": false
}
```

Returns the new playlist object including `id`.

### Add Tracks to Playlist

```
POST /playlists/{playlist_id}/tracks
Content-Type: application/json

{
  "uris": ["spotify:track:...", "spotify:track:...", ...]
}
```

- Max 100 URIs per request (this is the `MAX_LIMIT_POST` from original code)
- Returns: `{ "snapshot_id": "..." }`

### Replace Playlist Tracks

```
PUT /playlists/{playlist_id}/tracks
Content-Type: application/json

{
  "uris": ["spotify:track:...", ...]
}
```

- Max 100 URIs — for larger playlists, clear first then add in chunks
- Use this for "replace" mode

---

## Pagination Pattern

The original `allPagesBuilder` pattern ports directly. In pseudocode:

```typescript
async function fetchAllPages<T>(
  endpoint: string,
  accessToken: string,
  limit = 50
): Promise<T[]> {
  const firstPage = await fetchPage(endpoint, accessToken, limit, 0);
  const total = firstPage.total;
  const items = [...firstPage.items];

  // Build remaining page fetches sequentially to avoid rate limits
  for (let offset = limit; offset < total; offset += limit) {
    const page = await fetchPage(endpoint, accessToken, limit, offset);
    items.push(...page.items);
  }

  return items;
}
```

## Rate Limits

- Spotify returns `429 Too Many Requests` with `Retry-After` header (seconds)
- No published hard limit — varies by endpoint and account
- Sequential execution (as in the original `sequence()`) naturally throttles
- Worker should check for 429 and wait `Retry-After` seconds before retrying

## Local Tracks

- URIs starting with `spotify:local:` cannot be added via API
- Original code filters these out: `.filter(t => t.indexOf('spotify:local') === -1)`
- We should do the same and surface these to the user as "skipped"

## Response Size Concerns

- Playlist track objects are large (album art, available_markets, etc.)
- Original code deletes `available_markets` from tracks and albums
- In the Worker, we should select only needed fields when building the response to the frontend
