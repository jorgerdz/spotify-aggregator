import { Hono } from "hono";
import type { Env, Session } from "../types";
import { requireAuth } from "../middleware/auth";
import { createPlaylist, bulkAddTracks } from "../spotify/client";

type MergeApp = { Bindings: Env; Variables: { session: Session } };

const merge = new Hono<MergeApp>();

merge.post("/", requireAuth, async (c) => {
    const session = c.get("session");
    const debugMode = c.req.query("debug") === "true";
    const logs: string[] = [];
    const log = (msg: string) => {
        const line = `[${new Date().toISOString()}] ${msg}`;
        console.log(line);
        logs.push(line);
    };

    try {
        log("Merge handler started.");
        const body = await c.req.json();
        if (!body || !Array.isArray(body.uris)) {
            return c.json({ error: "Missing or invalid uris array" }, 400);
        }

        const { uris, targetPlaylistConfig } = body as {
            uris: string[];
            targetPlaylistConfig: {
                id?: string;
                name?: string;
                description?: string;
                public?: boolean;
            };
        };
        log(`Requested merge for ${uris.length} tracks.`);

        if (uris.length === 0) {
            return c.json({ error: "No tracks provided to merge" }, 400);
        }
        if (uris.length > 10000) {
            return c.json({ error: "Too many tracks provided to merge (max 10000)" }, 400);
        }

        let targetPlaylistId = targetPlaylistConfig?.id;

        // If an ID wasn't provided, we need to create a brand new playlist first
        if (!targetPlaylistId) {
            log(`No target ID provided. Creating new playlist: ${targetPlaylistConfig?.name}`);
            if (!targetPlaylistConfig?.name) {
                return c.json({ error: "Missing new playlist name" }, 400);
            }
            if (targetPlaylistConfig.name.length > 150) {
                return c.json({ error: "Playlist name too long (max 150)" }, 400);
            }
            if (targetPlaylistConfig.description && targetPlaylistConfig.description.length > 300) {
                return c.json({ error: "Playlist description too long (max 300)" }, 400);
            }

            targetPlaylistId = await createPlaylist(
                session.accessToken,
                session.user.id,
                targetPlaylistConfig.name,
                targetPlaylistConfig.description || "",
                targetPlaylistConfig.public ?? false
            );
            log(`Created playlist: ${targetPlaylistId}`);
        } else {
            log(`Using existing target playlist: ${targetPlaylistId}`);
        }

        // Now securely chunk the array 100 uris at a time and post sequentially
        log(`Initiating bulk add for ${uris.length} tracks...`);
        await bulkAddTracks(session.accessToken, targetPlaylistId, uris);
        log(`Successfully merged ${uris.length} tracks.`);

        return c.json({
            success: true,
            playlistId: targetPlaylistId,
            trackCount: uris.length,
            logs: debugMode ? logs : undefined
        });
    } catch (error: any) {
        log(`FATAL MERGE ERROR: ${error.message}`);
        console.error("[API] Fatal merge tracks error details:", {
            message: error.message,
            stack: error.stack,
            cause: error.cause,
            response: error.response,
            raw: error
        });
        return c.json({ error: String(error.message || error), logs }, 500);
    }
});

export default merge;
