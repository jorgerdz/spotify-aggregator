import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { usePlaylists } from "../hooks/usePlaylists";
import { MergePreview } from "./MergePreview";

interface User {
  id: string;
  displayName: string | null;
  image: string | null;
}

interface HomeProps {
  user: User;
  onLogout: () => void;
}

export function Home({ user, onLogout }: HomeProps) {
  const {
    playlists, loading, error, hasMore, loadMore,
    totalPlaylists, isFetchingAll, fetchAllPlaylists
  } = usePlaylists();

  // Initialize from LocalStorage
  const [pattern, setPattern] = useState(() => {
    return localStorage.getItem("spotify-agg-regex") || "";
  });

  const [mode, setMode] = useState<"include" | "exclude">("include");
  const [ownershipFilter, setOwnershipFilter] = useState<"all" | "owned" | "followed">("all");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Persist valid patterns
  useEffect(() => {
    try {
      if (pattern) {
        // Verify valid pattern before saving
        const match = pattern.match(/^\/(.+)\/([gimsuy]*)$/);
        if (match) new RegExp(match[1], match[2] || "i");
        else new RegExp(pattern, "i");
        localStorage.setItem("spotify-agg-regex", pattern);
      } else {
        localStorage.removeItem("spotify-agg-regex");
      }
    } catch {
      // do not save if invalid regex
    }
  }, [pattern]);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback(
    (node: HTMLDivElement) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      });

      if (node) observer.current.observe(node);
    },
    [loading, hasMore, loadMore]
  );

  const parsePattern = (input: string): RegExp => {
    const match = input.match(/^\/(.+)\/([gimsuy]*)$/);
    if (match) {
      return new RegExp(match[1], match[2] || "i");
    }
    return new RegExp(input, "i");
  };

  const filteredPlaylists = useMemo(() => {
    return playlists.filter((p) => {
      // 1. Check Ownership Filter
      const isOwned = p.owner.id === user.id;
      if (ownershipFilter === "owned" && !isOwned) return false;
      if (ownershipFilter === "followed" && isOwned) return false;

      // 2. Check Regex Pattern
      if (!pattern) return true;
      try {
        const regex = parsePattern(pattern);
        const matches = regex.test(p.name);
        return mode === "include" ? matches : !matches;
      } catch (e) {
        // Invalid regex, don't filter out things based on it
        return true;
      }
    });
  }, [playlists, pattern, mode, ownershipFilter, user.id]);

  const isValidRegex = useMemo(() => {
    if (!pattern) return true;
    try {
      parsePattern(pattern);
      return true;
    } catch {
      return false;
    }
  }, [pattern]);

  return (
    <div className="home">
      <header className="header">
        <h1>Spotify Aggregator</h1>
        <div className="user-info">
          {user.image && <img src={user.image} alt="" className="avatar" />}
          <span>{user.displayName || user.id}</span>
          <button onClick={onLogout} className="logout-button">
            Log out
          </button>
        </div>
      </header>

      <main className="main-content">
        <section className="filter-section card">
          <div className="filter-controls">

            {/* Regex Input Group */}
            <div className="input-group">
              <label htmlFor="regex">Regex Pattern</label>
              <div className="input-wrapper">
                <input
                  id="regex"
                  type="text"
                  placeholder="\d+/\d+"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  className={!isValidRegex ? "invalid" : ""}
                />
                {pattern && isValidRegex && <span className="input-icon success">✓</span>}
                {!isValidRegex && <span className="input-icon error">!</span>}
              </div>
              {!isValidRegex && (
                <span className="error-text">Invalid regular expression</span>
              )}
            </div>

            {/* Mode Toggle */}
            <div className="toggle-container">
              <label>Regex Mode</label>
              <div className="segmented-control">
                <button
                  className={`segment ${mode === "include" ? "active" : ""}`}
                  onClick={() => setMode("include")}
                >
                  Include
                </button>
                <button
                  className={`segment ${mode === "exclude" ? "active" : ""}`}
                  onClick={() => setMode("exclude")}
                >
                  Exclude
                </button>
              </div>
            </div>

            {/* Ownership Toggle */}
            <div className="toggle-container">
              <label>Ownership</label>
              <div className="segmented-control">
                <button
                  className={`segment ${ownershipFilter === "all" ? "active" : ""}`}
                  onClick={() => setOwnershipFilter("all")}
                >
                  All
                </button>
                <button
                  className={`segment ${ownershipFilter === "owned" ? "active" : ""}`}
                  onClick={() => setOwnershipFilter("owned")}
                >
                  Mine
                </button>
                <button
                  className={`segment ${ownershipFilter === "followed" ? "active" : ""}`}
                  onClick={() => setOwnershipFilter("followed")}
                >
                  Followed
                </button>
              </div>
            </div>

          </div>

          <div className="filter-stats" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <span>
                Displaying <span className="highlight-stat">{filteredPlaylists.length}</span> out of {playlists.length} loaded
                {totalPlaylists ? ` (Total: ${totalPlaylists})` : ''}
              </span>

              {pattern && isValidRegex && hasMore && (
                <button
                  onClick={fetchAllPlaylists}
                  disabled={isFetchingAll || loading}
                  style={{
                    background: "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    padding: "0.25rem 0.75rem",
                    borderRadius: "4px",
                    color: "var(--text-primary)",
                    fontSize: "0.8rem",
                    cursor: (isFetchingAll || loading) ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem"
                  }}
                >
                  {isFetchingAll ? "Scanning Library..." : "Scan Entire Library"}
                </button>
              )}
            </div>

            {((filteredPlaylists.length > 0) || hasMore) && pattern && isValidRegex && (
              <button
                className="login-button"
                onClick={async () => {
                  if (hasMore && !isFetchingAll) {
                    await fetchAllPlaylists();
                  }
                  setIsPreviewOpen(true);
                }}
                disabled={isFetchingAll || loading}
                style={{
                  margin: 0,
                  padding: "0.5rem 1.5rem",
                  opacity: (isFetchingAll || loading) ? 0.7 : 1,
                  cursor: (isFetchingAll || loading) ? "not-allowed" : "pointer"
                }}
              >
                {isFetchingAll ? "Scanning Library..." : `Preview Tracks (${filteredPlaylists.length}${hasMore ? "+" : ""}) →`}
              </button>
            )}
          </div>
        </section>

        <section className="playlists-section">
          <div className="playlists-grid">
            {filteredPlaylists.map((p, index) => {
              const isLastElement = index === filteredPlaylists.length - 1;
              const isFollowed = p.owner.id !== user.id;

              return (
                <div
                  key={p.id}
                  className="playlist-card"
                  ref={isLastElement ? lastElementRef : null}
                >
                  <div className="cover-wrapper">
                    {p.images && p.images.length > 0 ? (
                      <img src={p.images[0].url} alt={p.name} />
                    ) : (
                      <div className="placeholder-cover">💿</div>
                    )}
                    {isFollowed && (
                      <div className="badge badge-followed">Followed</div>
                    )}
                  </div>
                  <div className="playlist-info">
                    <h3 className="playlist-name">{p.name}</h3>
                    <div className="playlist-meta-row">
                      <span className="track-count">{p.tracks.total} tracks</span>
                      {isFollowed && (
                        <span className="owner-name">• By {p.owner.display_name}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredPlaylists.length === 0 && !loading && playlists.length > 0 && (
            <div className="empty-state" style={{ textAlign: "center", padding: "4rem 2rem", background: "var(--card-bg)", borderRadius: "var(--radius-lg)", marginTop: "2rem" }}>
              <h3 style={{ color: "var(--text-primary)", fontSize: "1.25rem", marginBottom: "0.5rem" }}>No playlists match your current filters</h3>
              <p style={{ color: "var(--text-secondary)" }}>Try tweaking your regex query or changing ownership flags!</p>
            </div>
          )}

          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading playlists...</p>
            </div>
          )}

          {error && <div className="error-text">Failed to load: {error}</div>}
        </section>
      </main>

      {isPreviewOpen && (
        <MergePreview
          playlists={filteredPlaylists}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}
    </div>
  );
}
