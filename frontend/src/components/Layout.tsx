import { Outlet } from "react-router-dom";
import ScrollToTop from "./ScrollToTop";
import Header from "./Header";

export default function Layout() {
  return (
    <>
      <ScrollToTop />
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />
      <main id="main" className="container" tabIndex={-1}>
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
