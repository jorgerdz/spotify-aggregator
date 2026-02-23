import { ArrowRight, Filter, Combine, Music } from "lucide-react";

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  return (
    <div className="landing">
      {/* Abstract Background */}
      <div className="landing-bg">
        <div className="glow glow-1"></div>
        <div className="glow glow-2"></div>
      </div>

      <nav className="landing-nav">
        <div className="logo">
          <Music className="logo-icon" />
          <span>Spotify Aggregator</span>
        </div>
      </nav>

      <main className="landing-main">
        <header className="hero">
          <div className="hero-badge">Meet your new playlist manager</div>
          <h1 className="hero-title">
            The ultimate tool for <br />
            <span className="text-gradient">Power Users</span>
          </h1>
          <p className="hero-subtitle">
            Take absolute control over your Spotify library. Filter, select, and merge thousands of playlists instantly using powerful regular expressions.
          </p>
          <button onClick={onLogin} className="cta-button">
            Connect Spotify <ArrowRight size={18} />
          </button>
        </header>

        <section className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Music className="feature-icon" />
            </div>
            <h3>1. Connect</h3>
            <p>Securely link your Spotify account to instantly load all your saved and followed playlists.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Filter className="feature-icon" />
            </div>
            <h3>2. Filter</h3>
            <p>Use Regex patterns to pinpoint exact playlists by name, bringing order to massive libraries.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Combine className="feature-icon" />
            </div>
            <h3>3. Merge</h3>
            <p>Preview and merge all matching tracks into a single, comprehensive super-playlist in seconds.</p>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <p>A simple, elegant tool for Spotify power users.</p>
      </footer>
    </div>
  );
}
