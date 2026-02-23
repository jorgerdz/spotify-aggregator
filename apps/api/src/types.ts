export interface Env {
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
  KV: KVNamespace;
  FRONTEND_URL: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: {
    id: string;
    displayName: string | null;
    image: string | null;
  };
}

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface SpotifyUserProfile {
  id: string;
  display_name: string | null;
  images: { url: string; width: number; height: number }[];
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  images: { url: string }[];
  tracks: { href: string; total: number };
  owner: { id: string; display_name: string };
}

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  is_local: boolean;
  album: {
    id: string;
    name: string;
    images: { url: string }[];
  };
  artists: {
    id: string;
    name: string;
  }[];
}

export interface SpotifyPlaylistTrack {
  added_at: string;
  track: SpotifyTrack | null; // Can be null if track is unavailable
}
