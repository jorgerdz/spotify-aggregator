import { useState, useEffect, useCallback, useRef } from "react";
import type { SpotifyPlaylist } from "../types";
import { apiFetch } from "../lib/api";

type PlaylistsResponse = {
    items: SpotifyPlaylist[];
    total: number;
    next: string | null;
};

export function usePlaylists() {
    const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
    const [loading, setLoading] = useState(false);
    const [isFetchingAll, setIsFetchingAll] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);
    const [totalPlaylists, setTotalPlaylists] = useState<number | null>(null);

    const loadingRef = useRef(false); // Prevents overlapping requests

    const fetchPlaylists = useCallback(async (currentOffset: number, isInitial = false) => {
        if (loadingRef.current) return;
        try {
            loadingRef.current = true;
            setLoading(true);
            setError(null);

            const data = await apiFetch<PlaylistsResponse>(
                `${import.meta.env.VITE_API_URL || "http://localhost:8787"}/api/playlists?offset=${currentOffset}&limit=50`
            );

            setPlaylists(prev => isInitial ? data.items : [...prev, ...data.items]);
            setHasMore(data.next !== null);
            setOffset(currentOffset + data.items.length);

            if (isInitial || totalPlaylists === null) {
                setTotalPlaylists(data.total);
            }

            return {
                nextOffset: currentOffset + data.items.length,
                hasMoreData: data.next !== null
            };
        } catch (e: any) {
            console.error(e);
            setError(e.message || "An error occurred fetching playlists.");
            return { nextOffset: currentOffset, hasMoreData: false };
        } finally {
            setLoading(false);
            loadingRef.current = false;
        }
    }, [totalPlaylists]);

    const loadMore = useCallback(() => {
        if (hasMore && !loading && !isFetchingAll) {
            fetchPlaylists(offset);
        }
    }, [hasMore, loading, offset, fetchPlaylists, isFetchingAll]);

    const fetchAllPlaylists = useCallback(async () => {
        if (!hasMore || isFetchingAll) return;

        setIsFetchingAll(true);
        let currentOffset = offset;
        let keepFetching = true;

        while (keepFetching) {
            const result = await fetchPlaylists(currentOffset);
            if (result) {
                currentOffset = result.nextOffset;
                keepFetching = result.hasMoreData;
            } else {
                keepFetching = false;
            }
        }
        setIsFetchingAll(false);
    }, [hasMore, isFetchingAll, offset, fetchPlaylists]);

    useEffect(() => {
        // Initial fetch
        fetchPlaylists(0, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        playlists,
        loading,
        error,
        hasMore,
        loadMore,
        totalPlaylists,
        isFetchingAll,
        fetchAllPlaylists
    };
}
