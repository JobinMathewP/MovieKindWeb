import { useEffect, useState } from "react";
import { posterUrl } from "../lib/posters";

type Props = {
  path: string | null;
  title: string;
  size?: "grid" | "hero";
};

export function Poster({ path, title, size = "grid" }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [path]);
  const src = posterUrl(path, size === "hero" ? "w780" : "w342");

  if (!src || failed) {
    return (
      <div className="tile" role="img" aria-label={title}>
        <span>{title}</span>
      </div>
    );
  }

  return <img className="poster-img" src={src} alt={title} onError={() => setFailed(true)} />;
}

export function CheckMark() {
  return (
    <span className="check" aria-hidden="true">
      <svg viewBox="0 0 20 20">
        <path
          d="M5 10.5l3.2 3.2L15 6.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
