import { Link } from "react-router-dom";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function NotFoundPage() {
  useDocumentTitle("Page not found");

  return (
    <section className="section" style={{ marginTop: "3rem" }}>
      <p className="meta">Error · 404</p>
      <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", margin: "0.5rem 0 1rem" }}>
        This file isn&rsquo;t in the archive.
      </h1>
      <p style={{ maxWidth: "52ch", marginBottom: "1.75rem" }}>
        The page you&rsquo;re looking for doesn&rsquo;t exist, or the case may not have
        been ingested. Try a search instead.
      </p>
      <div className="badges" style={{ alignItems: "center" }}>
        <Link to="/" className="btn btn--primary">
          ← Back to search
        </Link>
        <Link to="/search?q=disc-shaped craft" className="chip">
          disc-shaped craft
        </Link>
        <Link to="/search?q=pilot sightings" className="chip">
          pilot sightings
        </Link>
      </div>
    </section>
  );
}
