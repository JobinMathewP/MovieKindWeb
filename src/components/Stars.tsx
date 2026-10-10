import { useId } from "react";

const STAR_PATH = "M10 1.6l2.4 5.2 5.7.7-4.2 3.9 1.1 5.6L10 14.2 4.9 17l1.1-5.6L1.8 7.5l5.7-.7L10 1.6z";

function Star({ fill, id }: { fill: number; id: string }) {
  const amount = Math.max(0, Math.min(1, fill));
  return (
    <svg viewBox="0 0 20 20" className="star" aria-hidden="true">
      <defs>
        <linearGradient id={id}>
          <stop offset={`${amount * 100}%`} stopColor="currentColor" />
          <stop offset={`${amount * 100}%`} stopColor="#3c3c40" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id})`} d={STAR_PATH} />
    </svg>
  );
}

export function Stars({ value, label }: { value: number; label?: string }) {
  const id = useId();
  const clamped = Math.max(0, Math.min(5, value));
  return (
    <span className="stars" aria-label={label ?? `${clamped} of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} id={`${id}-${index}`} fill={clamped - index} />
      ))}
    </span>
  );
}
