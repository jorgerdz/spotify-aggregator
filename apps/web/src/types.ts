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
