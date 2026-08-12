import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import logoUrl from "../assets/logo-mark.svg";

const LINKS = [
  { to: "/search", label: "Search" },
  { to: "/map", label: "Map" },
  { to: "/browse", label: "Browse" },
  { to: "/about", label: "How it works" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the mobile menu on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="hdr">
      <div className="hdr__bar">
        <Link to="/" className="hdr__brand" aria-label="UAP Archive — home">
          <img src={logoUrl} className="hdr__logo" alt="" width={38} height={38} />
          <span className="hdr__word">UAP Archive</span>
        </Link>

        <nav className="hdr__nav" aria-label="Primary">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `hdr__link ${isActive ? "hdr__link--active" : ""}`
              }
            >
              {l.label}
            </NavLink>
          ))}
          <a
            className="hdr__link"
            href="https://github.com/CHRISTIANSEBO/uap-archive"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
        </nav>

        <button
          className="hdr__menu-btn"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`hdr__menu-icon ${open ? "is-open" : ""}`} aria-hidden />
        </button>
      </div>

      {open && (
        <nav className="hdr__drawer" aria-label="Mobile">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `hdr__drawer-link ${isActive ? "hdr__drawer-link--active" : ""}`
              }
            >
              {l.label}
            </NavLink>
          ))}
          <a
            className="hdr__drawer-link"
            href="https://github.com/CHRISTIANSEBO/uap-archive"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
        </nav>
      )}
    </header>
  );
}
