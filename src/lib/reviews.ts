import { api } from "./api";
import type { Film, Review } from "./types";

export async function saveReview(tmdbId: number, rating: number | null, body: string | null): Promise<Review> {
  await api<Film>("/films", { method: "POST", body: { tmdbId } });
  const text = body?.trim() ?? "";
  return api<Review>("/reviews", {
    method: "PUT",
    body: { tmdbId, rating, body: text.length > 0 ? text : null },
  });
}
