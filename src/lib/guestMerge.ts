import { api, ApiError } from "./api";
import { saveReview } from "./reviews";
import { currentIsGuest, supabase } from "./supabase";
import type { Review } from "./types";

const STASH_KEY = "mk-guest-reviews";

type StashedReview = {
  tmdbId: number;
  rating: number | null;
  body: string | null;
};

export async function linkGoogle(): Promise<void> {
  if (!supabase) return;
  await stashGuestReviews();
  const { error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export function clearGuestReviews(): void {
  localStorage.removeItem(STASH_KEY);
}

async function stashGuestReviews(): Promise<void> {
  let reviews: Review[] = [];
  try {
    reviews = await api<Review[]>("/me/reviews");
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
  const stash: StashedReview[] = reviews.map((review) => ({
    tmdbId: review.tmdbId,
    rating: review.rating,
    body: review.body,
  }));
  localStorage.setItem(STASH_KEY, JSON.stringify(stash));
}

export async function mergeGuestReviews(): Promise<void> {
  const raw = localStorage.getItem(STASH_KEY);
  if (!raw) return;
  if (await currentIsGuest()) return;
  let stash: StashedReview[];
  try {
    stash = JSON.parse(raw) as StashedReview[];
  } catch {
    localStorage.removeItem(STASH_KEY);
    return;
  }
  if (!Array.isArray(stash)) {
    localStorage.removeItem(STASH_KEY);
    return;
  }
  const existing = await api<Review[]>("/me/reviews");
  const have = new Set(existing.map((review) => review.tmdbId));
  for (const review of stash) {
    if (have.has(review.tmdbId)) continue;
    await saveReview(review.tmdbId, review.rating, review.body);
  }
  localStorage.removeItem(STASH_KEY);
}
