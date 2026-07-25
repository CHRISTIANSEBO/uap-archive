import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets scroll to the top whenever the path changes. Without this, navigating
 * from a long results/case page to another route keeps the previous scroll
 * offset, so the new page appears to open "half-way down".
 *
 * Only pathname is watched (not search): changing filters/query on the results
 * page should not yank the viewport back to the top mid-interaction.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Instant jump (not smooth): a route change is a fresh page, not a scroll
    // gesture, so animating would feel wrong and ignore reduced-motion prefs.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}
