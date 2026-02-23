import { useState, useCallback, useMemo } from "react";
import type { SpotifyTrack } from "../types";
import { apiFetch } from "../lib/api";

export interface MergedTrack extends SpotifyTrack {
    added_at: string;
    source_playlist_id: string;
}

export type SortOption = "default" | "alphabetical" | "source";

export function useMergePreview() {
    const [tracks, setTracks] = useState<MergedTrack[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [deduplicate, setDeduplicate] = useState(true);
    const [sortOption, setSortOption] = useState<SortOption>("default");

    const generatePreview = useCallback(async (playlistIds: string[]) => {
        if (playlistIds.length === 0) {
            setTracks([]);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Read debug flag from site URL
            const searchParams = new URL(window.location.href).searchParams;
            const isDebug = searchParams.get("debug") === "true";
            const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8787";
            const endpoint = `${apiBase}/api/tracks${isDebug ? "?debug=true" : ""}`;

            const res = await apiFetch<{ tracks: MergedTrack[] }>(
                endpoint,
                {
                    method: "POST",
                    body: JSON.stringify({ playlistIds })
                }
            );

            setTracks(res.tracks);
        } catch (e: any) {
            console.error("Preview generation failed:", e);
            setError(e.message || "Failed to generate track preview.");
        } finally {
            setLoading(false);
        }
    }, []);

    const processedTracks = useMemo(() => {
        let result = [...tracks];

        // 1. Filter out local tracks
        result = result.filter(t => !t.is_local);

        // 2. Deduplicate
        if (deduplicate) {
            const seenUris = new Set<string>();
            result = result.filter(t => {
                if (seenUris.has(t.uri)) return false;
                seenUris.add(t.uri);
                return true;
            });
        }

        // 3. Sort
        switch (sortOption) {
            case "alphabetical":
                result.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case "source":
                result.sort((a, b) => a.source_playlist_id.localeCompare(b.source_playlist_id));
                break;
            case "default":
            default:
                // Keep the original fetched order (by playlist order, then track order)
                break;
        }

        return result;
    }, [tracks, deduplicate, sortOption]);

    const stats = useMemo(() => {
        return {
            totalInputTracks: tracks.length,
            finalTracks: processedTracks.length,
            duplicatesRemoved: tracks.length - processedTracks.length
        };
    }, [tracks.length, processedTracks.length]);

    return {
        tracks: processedTracks,
        stats,
        loading,
        error,
        deduplicate,
        setDeduplicate,
        sortOption,
        setSortOption,
        generatePreview,
        clearPreview: () => setTracks([])
    };
}
