import type { SpotifyTokenResponse, SpotifyUserProfile, SpotifyPlaylist } from "../types";
import { fetchAllPages } from "./pagination";

const ACCOUNTS_BASE = "https://accounts.spotify.com";
const API_BASE = "https://api.spotify.com/v1";

export async function exchangeCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<SpotifyTokenResponse> {
  const res = await fetch(`${ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${body}`);
  }

  return res.json();
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<SpotifyTokenResponse> {
  const res = await fetch(`${ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }

  return res.json();
}

export async function getCurrentUser(
  accessToken: string
): Promise<SpotifyUserProfile> {
  const res = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to get user profile (${res.status})`);
  }

  return res.json();
}

export function buildAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const scopes = [
    "playlist-read-private",
    "playlist-modify-private",
    "playlist-modify-public",
  ];

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: scopes.join(" "),
    redirect_uri: redirectUri,
    state,
  });

  return `${ACCOUNTS_BASE}/authorize?${params}`;
}

export async function getUserPlaylistsPage(
  accessToken: string,
  offset: number = 0,
  limit: number = 50
): Promise<{ items: SpotifyPlaylist[]; total: number; next: string | null }> {
  const url = `${API_BASE}/me/playlists?limit=${limit}&offset=${offset}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to get playlists (${res.status}): ${body}`);
  }

  const data = await res.json() as { items: SpotifyPlaylist[]; total: number; next: string | null };
  return {
    items: data.items,
    total: data.total,
    next: data.next
  };
}

export async function getPlaylistTracks(
  accessToken: string,
  playlistId: string
): Promise<import("../types").SpotifyPlaylistTrack[]> {
  // We specify the fields we need to reduce payload size
  const fields = "items(added_at,track(id,uri,name,duration_ms,is_local,album(id,name,images),artists(id,name))),next";
  const url = `${API_BASE}/playlists/${playlistId}/tracks?fields=${encodeURIComponent(fields)}&limit=50`;

  return fetchAllPages<import("../types").SpotifyPlaylistTrack>(url, accessToken, 50);
}

export async function createPlaylist(
  accessToken: string,
  userId: string,
  name: string,
  description: string,
  isPublic: boolean
): Promise<string> {
  const url = `${API_BASE}/users/${userId}/playlists`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      description,
      public: isPublic,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create playlist (${res.status}): ${body}`);
  }

  const data = await res.json() as { id: string };
  return data.id;
}

export async function addTracksToPlaylist(
  accessToken: string,
  playlistId: string,
  uris: string[]
): Promise<void> {
  if (uris.length === 0) return;

  const url = `${API_BASE}/playlists/${playlistId}/tracks`;
  let maxRetries = 3;

  while (true) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris }),
    });

    if (res.status === 429) {
      if (maxRetries > 0) {
        maxRetries--;
        const retryAfter = res.headers.get("Retry-After");
        const waitTimeMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 3000;
        console.warn(`[API] Rate limited (429) on saving tracks. Waiting ${waitTimeMs}ms. Retries left: ${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, waitTimeMs));
        continue;
      }
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to add tracks (${res.status}): ${body}`);
    }

    break; // Success
  }
}

export async function bulkAddTracks(
  accessToken: string,
  playlistId: string,
  uris: string[]
): Promise<void> {
  // The Spotify API restricts to 100 tracks per POST request
  const chunkSize = 100;

  for (let i = 0; i < uris.length; i += chunkSize) {
    const chunk = uris.slice(i, i + chunkSize);
    await addTracksToPlaylist(accessToken, playlistId, chunk);
  }
}
