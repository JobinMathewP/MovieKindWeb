import { api } from "./api";
import type { Review } from "./types";

export async function saveReview(tmdbId: number, rating: number | null, body: string | null): Promise<Review> {
  const text = body?.trim() ?? "";
  return api<Review>("/reviews", {
    method: "PUT",
    body: { tmdbId, rating, body: text.length > 0 ? text : null },
  });
}
