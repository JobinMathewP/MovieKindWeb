import type { LikedFilm, Review } from "./types";

export function isLike(rating: number | null): rating is number {
  return rating != null && rating >= 4;
}

export function toLiked(review: Review): LikedFilm | null {
  if (!isLike(review.rating)) return null;
  return {
    tmdbId: review.tmdbId,
    title: review.film.title || "Untitled",
    year: review.film.year,
    posterPath: review.film.posterPath,
    genres: review.film.genres ?? [],
    rating: review.rating,
  };
}

export function formatRuntime(minutes: number | null): string | null {
  if (minutes == null || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function metaLine(year: number | null, genres: string[], runtime: string | null): string {
  return [year, ...genres, runtime].filter((part) => part != null && String(part).length > 0).join(" · ");
}

export function joinTitles(titles: string[]): string {
  if (titles.length <= 1) return titles[0] ?? "these films";
  if (titles.length === 2) return `${titles[0]} and ${titles[1]}`;
  return `${titles.slice(0, -1).join(", ")}, and ${titles[titles.length - 1]}`;
}

export function lovedSentence(count: number, seedTitles: string[]): string {
  return `Loved by ${count} people who also loved ${joinTitles(seedTitles)}.`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
