import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/** Top-level boundary so an unexpected render error shows a graceful, on-brand
 * fallback instead of a blank white page. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept minimal; a real deploy would forward this to an error tracker.
    console.error("Unhandled UI error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="container">
          <section className="section" style={{ marginTop: "3rem" }}>
            <p className="meta">Something went wrong</p>
            <h1 style={{ fontSize: "2rem", margin: "0.5rem 0 1rem" }}>
              this page hit an unexpected error.
            </h1>
            <p className="incomplete">
              Try reloading. If it keeps happening, the API may be unavailable.
            </p>
            <a className="btn btn--primary" href="/" style={{ marginTop: "1rem", display: "inline-block" }}>
              ← Back to search
            </a>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
