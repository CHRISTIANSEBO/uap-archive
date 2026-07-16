import { Link, Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <>
      <nav className="nav" aria-label="Primary">
        <Link to="/" className="nav__brand">
          <span className="nav__dot" aria-hidden />
          UAP Archive
        </Link>
        <a
          className="btn btn--ghost"
          href="https://archive.org/details/project-blue-book"
          target="_blank"
          rel="noreferrer"
        >
          Source →
        </a>
      </nav>
      <main className="container">
        <Outlet />
      </main>
      <footer className="container section" style={{ marginTop: "6rem" }}>
        <hr className="rule" />
        <p className="meta">
          Documents: U.S. Air Force Project Blue Book · NARA T1206 · mirrored on
          archive.org. Presented for public research. Summaries are
          machine-generated from document text and cite their source.
        </p>
      </footer>
    </>
  );
}
