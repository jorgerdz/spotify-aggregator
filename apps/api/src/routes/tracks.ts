import { Hono } from "hono";
import type { Env, Session, SpotifyPlaylistTrack } from "../types";
import { requireAuth } from "../middleware/auth";
import { getPlaylistTracks } from "../spotify/client";

import pLimit from "p-limit";

type TracksApp = { Bindings: Env; Variables: { session: Session } };

const tracks = new Hono<TracksApp>();

tracks.post("/", requireAuth, async (c) => {
    const session = c.get("session");
    const debugMode = c.req.query("debug") === "true";
    const logs: string[] = [];
    const log = (msg: string) => {
        const line = `[${new Date().toISOString()}] ${msg}`;
        console.log(line);
        logs.push(line);
    };

    try {
        log("Handler started.");
        const body = await c.req.json();
        if (!body || !Array.isArray(body.playlistIds)) {
            return c.json({ error: "Missing or invalid playlistIds array" }, 400);
        }

        const { playlistIds } = body as { playlistIds: string[] };
        log(`Received request for ${playlistIds.length} playlists.`);

        if (playlistIds.length === 0) {
            return c.json({ tracks: [], logs: debugMode ? logs : undefined });
        }
        if (playlistIds.length > 200) {
            return c.json({ error: "Too many playlists requested (max 200)" }, 400);
        }

        // Limit concurrency if resolving many playlists to avoid immediate rate limit spikes
        const limit = pLimit(3); // Process at most 3 playlists concurrently
        log("Concurrency pool created (limit 3). Fetching playlists...");

        const allTracksArrays = await Promise.all(
            playlistIds.map(async (id, index) => {
                return limit(async () => {
                    log(`Starting fetch for playlist ${id} (${index + 1}/${playlistIds.length})`);
                    try {
                        const tracks = await getPlaylistTracks(session.accessToken, id);
                        log(`Success fetching ${tracks.length} tracks from ${id}`);
                        return tracks;
                    } catch (e: any) {
                        log(`ERROR on playlist ${id}: ${e.message}`);
                        throw e;
                    }
                });
            })
        );
        log(`Fetched successfully all arrays. Mapping merged tracks...`);

        // Flatten logic while attaching the source playlist ID to each track for the UI
        const mergedTracks = allTracksArrays.flatMap((trackArray, index) =>
            trackArray
                .filter((pt) => pt.track !== null) // Filter out null tracks (can happen if track is removed/unavailable)
                .map((pt) => ({
                    ...pt.track,
                    added_at: pt.added_at,
                    source_playlist_id: playlistIds[index],
                }))
        );

        log(`Mapping complete. Total merged tracks: ${mergedTracks.length}`);

        return c.json({ tracks: mergedTracks, logs: debugMode ? logs : undefined });
    } catch (error: any) {
        log(`FATAL ERROR: ${error.message}`);
        console.error("[API] Fatal fetch tracks error details:", {
            message: error.message,
            stack: error.stack,
            cause: error.cause,
            response: error.response,
            raw: error
        });

        // If the Spotify API threw a 401 error during pagination (Invalid access token)
        if (error.message && error.message.includes("401")) {
            return c.json({ error: "Spotify access token expired or invalid.", logs }, 401);
        }

        return c.json({ error: String(error.message || error), logs }, 500);
    }
});

export default tracks;
