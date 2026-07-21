import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="section" style={{ marginTop: "3rem" }}>
      <p className="meta">Error · 404</p>
      <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", margin: "0.5rem 0 1rem" }}>
        This file isn&rsquo;t in the archive.
      </h1>
      <p style={{ maxWidth: "52ch", marginBottom: "1.75rem" }}>
        The page you were looking for doesn&rsquo;t exist — it may have been moved,
        or the case link is malformed. Try searching the declassified files instead.
      </p>
      <div className="badges">
        <Link to="/" className="btn btn--primary">
          ← Back to search
        </Link>
      </div>
    </section>
  );
}
