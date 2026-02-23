import { Hono } from "hono";
import type { Env, Session } from "../types";
import { requireAuth } from "../middleware/auth";
import { getUserPlaylistsPage } from "../spotify/client";

type PlaylistApp = { Bindings: Env; Variables: { session: Session } };

const playlists = new Hono<PlaylistApp>();

playlists.get("/", requireAuth, async (c) => {
  const session = c.get("session");
  const limit = parseInt(c.req.query("limit") ?? "50", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);

  try {
    const pageData = await getUserPlaylistsPage(session.accessToken, offset, limit);
    return c.json(pageData);
  } catch (error: any) {
    console.error("Failed to fetch playlists:", error);
    return c.json({ error: "Failed to fetch playlists" }, 500);
  }
});

export default playlists;
