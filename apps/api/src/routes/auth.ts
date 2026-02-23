import { Hono } from "hono";
import type { Env, Session } from "../types";
import {
  buildAuthorizeUrl,
  exchangeCode,
  getCurrentUser,
} from "../spotify/client";
import { requireAuth } from "../middleware/auth";

type AuthApp = { Bindings: Env; Variables: { session: Session } };

const auth = new Hono<AuthApp>();

// Redirect user to Spotify's authorize page
auth.get("/login", (c) => {
  const state = crypto.randomUUID();
  const baseUrl = c.req.url.includes("localhost")
    ? c.req.url.replace("localhost", "127.0.0.1")
    : c.req.url;
  const callbackUrl = new URL("/auth/callback", baseUrl).toString();

  const url = buildAuthorizeUrl(
    c.env.SPOTIFY_CLIENT_ID,
    callbackUrl,
    state
  );

  return c.redirect(url);
});

// Spotify redirects here after user approves
auth.get("/callback", async (c) => {
  const code = c.req.query("code");
  const error = c.req.query("error");

  if (error || !code) {
    const frontendUrl = new URL(c.env.FRONTEND_URL);
    frontendUrl.searchParams.set("auth_error", error || "no_code");
    return c.redirect(frontendUrl.toString());
  }

  const baseUrl = c.req.url.includes("localhost")
    ? c.req.url.replace("localhost", "127.0.0.1")
    : c.req.url;
  const callbackUrl = new URL("/auth/callback", baseUrl).toString();

  const tokens = await exchangeCode(
    code,
    callbackUrl,
    c.env.SPOTIFY_CLIENT_ID,
    c.env.SPOTIFY_CLIENT_SECRET
  );

  const user = await getCurrentUser(tokens.access_token);

  const sessionId = crypto.randomUUID();
  const session: Session = {
    user: {
      id: user.id,
      displayName: user.display_name,
      image: user.images?.[0]?.url ?? null,
    },
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token!,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };

  await c.env.KV.put(`session:${sessionId}`, JSON.stringify(session), {
    expirationTtl: 60 * 60 * 24 * 30, // 30 days
  });

  // Redirect to frontend with session token
  const frontendUrl = new URL("/callback", c.env.FRONTEND_URL);
  frontendUrl.searchParams.set("session", sessionId);
  return c.redirect(frontendUrl.toString());
});

// Get current user's profile
auth.get("/me", requireAuth, async (c) => {
  const session = c.get("session");
  const user = await getCurrentUser(session.accessToken);

  return c.json({
    id: user.id,
    displayName: user.display_name,
    image: user.images?.[0]?.url ?? null,
  });
});

// Logout — delete session from KV
auth.post("/logout", async (c) => {
  const header = c.req.header("Authorization");
  if (header?.startsWith("Bearer ")) {
    const sessionId = header.slice(7);
    await c.env.KV.delete(`session:${sessionId}`);
  }
  return c.json({ ok: true });
});

export default auth;
