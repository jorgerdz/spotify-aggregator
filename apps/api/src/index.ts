import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, Session } from "./types";
import auth from "./routes/auth";
import playlists from "./routes/playlists";
import tracks from "./routes/tracks";
import merge from "./routes/merge";

const app = new Hono<{ Bindings: Env; Variables: { session: Session } }>();

app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow localhost during dev
      if (origin?.startsWith("http://localhost:")) return origin;
      // Allow production frontend
      if (origin === "https://spotify-aggregator.pages.dev") return origin;
      return "";
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  })
);

app.route("/auth", auth);
app.route("/api/playlists", playlists);
app.route("/api/tracks", tracks);
app.route("/api/merge", merge);

app.get("/api/health", (c) => c.json({ status: "ok" }));

export default app;
