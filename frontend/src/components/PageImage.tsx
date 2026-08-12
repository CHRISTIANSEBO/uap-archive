import { useState } from "react";
import type { PageOut } from "../types";

/**
 * Renders a single scanned document page. Tries the locally-served scan first,
 * then falls back to the public archive.org IIIF render, and finally to a clean
 * "open original" placeholder — so a missing scan never shows a broken-image
 * icon. Click to open the full-resolution page in a lightbox.
 */
export default function PageImage({
  page,
  caseId,
  onOpen,
}: {
  page: PageOut;
  caseId: string;
  onOpen: (src: string) => void;
}) {
  // Ordered list of sources to attempt.
  const sources = [page.image_url, page.iiif_url].filter(Boolean) as string[];
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(sources.length === 0);
  const src = sources[idx];

  if (failed || !src) {
    return (
      <a
        className="doc-page doc-page--missing"
        href={page.source_url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open page ${page.page_number} on archive.org`}
      >
        <span className="doc-page__ph-icon" aria-hidden>
          ⌗
        </span>
        <span className="meta">Page {page.page_number} · open on archive.org →</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      className="doc-page"
      onClick={() => onOpen(src)}
      aria-label={`Enlarge page ${page.page_number} of case ${caseId}`}
    >
      <img
        src={src}
        alt={`Scanned page ${page.page_number} of case ${caseId}`}
        loading="lazy"
        onError={() => {
          if (idx + 1 < sources.length) setIdx(idx + 1);
          else setFailed(true);
        }}
      />
      <span className="doc-page__zoom" aria-hidden>
        ⤢
      </span>
    </button>
  );
}
