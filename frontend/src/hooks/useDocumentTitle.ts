import { useEffect } from "react";

const SUFFIX = "UAP Archive";

/**
 * Sets document.title for the current view and restores the previous title on
 * unmount. Every page shares the "… — UAP Archive" suffix so browser tabs,
 * history, and bookmarks are meaningful instead of the single static title.
 */
export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} — ${SUFFIX}` : SUFFIX;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
