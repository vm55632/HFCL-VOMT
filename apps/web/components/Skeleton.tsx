// Placeholder blocks shown while data loads, instead of a "Loading…" string.

export function SkeletonLines({ count = 3 }: { count?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="skeleton sk-line" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="skeleton sk-row" />
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="kpis" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="skeleton" style={{ height: 78 }} />
      ))}
    </div>
  );
}
