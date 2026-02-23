import { createMiddleware } from "hono/factory";
import type { Env, Session } from "../types";
import { refreshAccessToken } from "../spotify/client";

type AuthEnv = {
  Bindings: Env;
  Variables: { session: Session };
};

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const sessionId = header.slice(7);
  const raw = await c.env.KV.get(`session:${sessionId}`);
  if (!raw) {
    return c.json({ error: "Invalid session" }, 401);
  }

  let session: Session = JSON.parse(raw);

  // Backward compatibility for legacy sessions
  if (!session.user && (session as any).spotifyUserId) {
    session.user = {
      id: (session as any).spotifyUserId,
      displayName: null,
      image: null,
    };
  }

  // Refresh token if expired (with 60s buffer)
  if (Date.now() > session.expiresAt - 60_000) {
    try {
      const tokens = await refreshAccessToken(
        session.refreshToken,
        c.env.SPOTIFY_CLIENT_ID,
        c.env.SPOTIFY_CLIENT_SECRET
      );

      session = {
        ...session,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? session.refreshToken,
        expiresAt: Date.now() + tokens.expires_in * 1000,
      };

      await c.env.KV.put(`session:${sessionId}`, JSON.stringify(session), {
        expirationTtl: 60 * 60 * 24 * 30, // 30 days
      });
    } catch {
      return c.json({ error: "Session expired, please log in again" }, 401);
    }
  }

  c.set("session", session);
  await next();
});
