import { useState } from "react";
import { useMergePreview, SortOption } from "../hooks/useMergePreview";
import type { SpotifyPlaylist } from "../types";
import { PublishPanel } from "../components/PublishPanel";

interface MergePreviewProps {
    playlists: SpotifyPlaylist[];
    onClose: () => void;
}

export function MergePreview({ playlists, onClose }: MergePreviewProps) {
    const [hasStarted, setHasStarted] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [successLink, setSuccessLink] = useState<string | null>(null);

    const {
        tracks,
        stats,
        loading,
        error,
        deduplicate,
        setDeduplicate,
        sortOption,
        setSortOption,
        generatePreview
    } = useMergePreview();

    const handleStart = () => {
        setHasStarted(true);
        generatePreview(playlists.map((p) => p.id));
    };

    const getSourcePlaylistName = (id: string) => {
        const p = playlists.find(p => p.id === id);
        return p ? p.name : id;
    };

    const formatDuration = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content preview-modal">
                <header className="modal-header">
                    <h2>{successLink ? "Merge Complete" : isPublishing ? "Publish Merge" : "Merge Preview"}</h2>
                    <button className="close-btn" onClick={onClose} disabled={isPublishing && !successLink}>×</button>
                </header>

                {!hasStarted && (
                    <div className="start-prompt">
                        <p>You have selected <strong>{playlists.length}</strong> playlists to merge.</p>
                        <button className="login-button" onClick={handleStart}>
                            Generate Track Preview
                        </button>
                    </div>
                )}

                {hasStarted && loading && (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Analyzing {playlists.length} playlists across Spotify API...</p>
                    </div>
                )}

                {hasStarted && !loading && error && (
                    <div className="error-state">
                        <p>Error: {error}</p>
                    </div>
                )}

                {hasStarted && !loading && !error && tracks && !isPublishing && !successLink && (
                    <div className="preview-container">
                        <div className="preview-controls">

                            <div className="stats-panel">
                                <div className="stat-box">
                                    <span className="stat-value">{stats.totalInputTracks}</span>
                                    <span className="stat-label">Raw</span>
                                </div>
                                <div className="stat-box">
                                    <span className="stat-value error-text">-{stats.duplicatesRemoved}</span>
                                    <span className="stat-label">Dupes</span>
                                </div>
                                <div className="stat-box">
                                    <span className="stat-value highlight-stat">{stats.finalTracks}</span>
                                    <span className="stat-label">Final Build</span>
                                </div>
                            </div>

                            <div className="toggle-container">
                                <label>Deduplication</label>
                                <div className="segmented-control">
                                    <button
                                        className={`segment ${deduplicate ? "active" : ""}`}
                                        onClick={() => setDeduplicate(true)}
                                    >
                                        Enabled
                                    </button>
                                    <button
                                        className={`segment ${!deduplicate ? "active" : ""}`}
                                        onClick={() => setDeduplicate(false)}
                                    >
                                        Disabled
                                    </button>
                                </div>
                            </div>

                            <div className="toggle-container">
                                <label>Sort order</label>
                                <select
                                    className="dropdown-select"
                                    value={sortOption}
                                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                                >
                                    <option value="default">Playlist Order</option>
                                    <option value="alphabetical">Alphabetical (Title)</option>
                                    <option value="source">By Source Playlist</option>
                                </select>
                            </div>

                        </div>

                        <div className="track-table-wrapper">
                            <table className="track-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Title</th>
                                        <th>Artist</th>
                                        <th>Album</th>
                                        <th>Time</th>
                                        <th>Source</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tracks.map((t, i) => (
                                        <tr key={`${t.id}-${i}`}>
                                            <td>{i + 1}</td>
                                            <td className="track-title">{t.name}</td>
                                            <td>{t.artists.map(a => a.name).join(", ")}</td>
                                            <td>{t.album.name}</td>
                                            <td>{formatDuration(t.duration_ms)}</td>
                                            <td>
                                                <span className="source-pill">
                                                    {getSourcePlaylistName(t.source_playlist_id)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="modal-footer">
                            <button className="logout-button" onClick={onClose}>Cancel</button>
                            <button className="login-button" onClick={() => setIsPublishing(true)}>
                                Continue to Publish ({stats.finalTracks} tracks) →
                            </button>
                        </div>
                    </div>
                )}

                {isPublishing && !successLink && (
                    <div className="publish-container" style={{ padding: "2rem", height: "100%", overflowY: "auto" }}>
                        <PublishPanel
                            uris={tracks.map(t => t.uri)}
                            onCancel={() => setIsPublishing(false)}
                            onSuccess={(link) => setSuccessLink(link)}
                        />
                    </div>
                )}

                {successLink && (
                    <div className="success-state" style={{ padding: "4rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
                        <div className="spinner" style={{ animation: "none", borderColor: "#1ed760", borderLeftColor: "#1ed760", background: "rgba(30, 215, 96, 0.2)" }}>✓</div>
                        <h2 style={{ fontSize: "2rem", color: "white" }}>Playlist Created Successfully!</h2>
                        <p style={{ color: "#b3b3b3" }}>Your new playlist has been generated with {stats.finalTracks} tracks.</p>
                        <a
                            href={successLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="login-button"
                            style={{ display: "inline-block", marginTop: "1rem", textDecoration: "none" }}
                        >
                            Open in Spotify
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
