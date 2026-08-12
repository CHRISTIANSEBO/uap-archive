import { useEffect } from "react";

/**
 * Minimal full-screen image viewer. Closes on Escape, backdrop click, or the
 * close button. Locks body scroll while open.
 */
export default function Lightbox({
  src,
  onClose,
}: {
  src: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Document page"
      onClick={onClose}
    >
      <button className="lightbox__close" aria-label="Close" onClick={onClose}>
        ✕
      </button>
      <img
        src={src}
        alt="Scanned document page, enlarged"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
