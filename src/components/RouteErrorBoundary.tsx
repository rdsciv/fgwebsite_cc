// Catches a failed route render — in practice, a lazy() chunk that would not load.
//
// The site deploys to GitHub Pages as an atomic swap of hashed assets. A tab left open across a
// deploy still holds the old index.html, so its next navigation requests a chunk filename that no
// longer exists. Without a boundary that rejection is an uncaught render error and the whole app
// goes blank; one reload pulls the new index.html and fixes it for good.
import { Component, type ErrorInfo, type ReactNode } from 'react';

const RELOAD_KEY = 'affl:chunk-reload-at';
const RELOAD_COOLDOWN_MS = 10_000;

// Browsers and bundlers all word this differently — Chrome, Firefox and Safari each have their own
// phrasing for a rejected dynamic import.
export function isChunkError(e: unknown): boolean {
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  return /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg);
}

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (!isChunkError(error)) {
      console.error('Route render failed', error, info.componentStack);
      return;
    }
    // Auto-reload once, then back off. The cooldown is what prevents a reload loop when the chunk
    // is genuinely gone: the retry fails again within seconds, so we fall through to manual UI.
    // It also self-heals — an unrelated chunk failure later in the session still gets its own retry.
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last > RELOAD_COOLDOWN_MS) {
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      window.location.reload();
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="page">
        <div className="empty">
          <p style={{ marginTop: 0 }}>
            {isChunkError(error)
              ? 'This page could not be loaded. The site may have been updated since you opened it.'
              : 'Something went wrong loading this page.'}
          </p>
          <button
            className="year-btn"
            onClick={() => {
              sessionStorage.removeItem(RELOAD_KEY);
              window.location.reload();
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
