import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * React Router does not restore scroll position on navigation, so moving from
 * a long results/case page to another route leaves the viewport scrolled down.
 * This component resets the scroll position to the top whenever the path
 * changes (respecting reduced-motion preferences).
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, left: 0, behavior: reduce ? "auto" : "smooth" });
  }, [pathname]);

  return null;
}
