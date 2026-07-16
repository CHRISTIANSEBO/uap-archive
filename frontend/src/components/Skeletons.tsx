export function CardSkeleton() {
  return (
    <div className="card" aria-hidden>
      <div className="skeleton" style={{ height: 24, width: "70%", marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 14, width: "100%", marginBottom: 6 }} />
      <div className="skeleton" style={{ height: 14, width: "85%" }} />
      <div className="badges">
        <div className="skeleton" style={{ height: 22, width: 70, borderRadius: 999 }} />
        <div className="skeleton" style={{ height: 22, width: 90, borderRadius: 999 }} />
      </div>
    </div>
  );
}

export function GridSkeleton({ n = 6 }: { n?: number }) {
  return (
    <div className="grid">
      {Array.from({ length: n }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
