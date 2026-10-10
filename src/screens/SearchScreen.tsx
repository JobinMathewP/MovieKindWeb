import { useEffect, useRef, useState } from "react";
import { Poster } from "../components/Poster";
import { ReviewSheet } from "../components/ReviewSheet";
import { Stars } from "../components/Stars";
import { api, errorText } from "../lib/api";
import { saveReview } from "../lib/reviews";
import type { Review, SearchHit } from "../lib/types";

type Props = {
  onReviewed: (review: Review) => void;
};

export function SearchPanel({ onReviewed }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [mine, setMine] = useState<Map<number, Review>>(new Map());
  const [draft, setDraft] = useState<SearchHit | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState("");
  const searchSeq = useRef(0);
  const trimmed = query.trim();

  useEffect(() => {
    let cancel = false;
    void api<Review[]>("/me/reviews")
      .then((reviews) => {
        if (cancel) return;
        setMine(new Map(reviews.map((review) => [review.tmdbId, review])));
      })
      .catch((caught) => {
        if (!cancel) setError(errorText(caught));
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      setPending(false);
      return;
    }
    setPending(true);
    const handle = window.setTimeout(() => {
      setPending(false);
      const seq = ++searchSeq.current;
      setSearching(true);
      void api<SearchHit[]>(`/films/search?q=${encodeURIComponent(trimmed)}`)
        .then((hits) => {
          if (seq !== searchSeq.current) return;
          setResults(hits);
          setError("");
        })
        .catch((caught) => {
          if (seq !== searchSeq.current) return;
          setResults([]);
          setError(errorText(caught));
        })
        .finally(() => {
          if (seq === searchSeq.current) setSearching(false);
        });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [trimmed]);

  async function save(rating: number, body: string | null) {
    if (!draft) return;
    setBusy(true);
    setSheetError("");
    try {
      const review = await saveReview(draft.tmdbId, rating, body);
      setMine((current) => new Map(current).set(review.tmdbId, review));
      onReviewed(review);
      setDraft(null);
    } catch (caught) {
      setSheetError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const existing = draft ? mine.get(draft.tmdbId) : undefined;

  return (
    <>
      <div className="scroll">
        <h1>Search</h1>
        <p className="lede">Find any movie and write a review.</p>
        <label className="search">
          <span className="sr-only">Search for a movie</span>
          <svg viewBox="0 0 24 24" className="search-icon" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M16 16.5 20 20.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            placeholder="Search for a movie..."
            onChange={(event) => {
              const next = event.target.value;
              setError("");
              setQuery(next);
              if (next.trim()) setPending(true);
              else {
                setPending(false);
                setSearching(false);
                setResults([]);
              }
            }}
          />
          {query ? (
            <button type="button" className="clear-search" aria-label="Clear search" onClick={() => setQuery("")}>
              ×
            </button>
          ) : null}
        </label>
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
        {trimmed === "" ? <p className="kicker">Type a film name to search.</p> : null}
        {trimmed !== "" && (pending || searching) && results.length === 0 ? <p className="kicker">Searching…</p> : null}
        {trimmed !== "" && !pending && !searching && results.length === 0 ? (
          <p className="kicker">No films found. Try another title.</p>
        ) : null}
        <div className="hit-list">
          {results.map((hit) => {
            const review = mine.get(hit.tmdbId);
            const meta = hitMeta(hit, review);
            return (
              <article key={hit.tmdbId} className="hit">
                <div className="frame">
                  <Poster path={hit.posterPath} title={hit.title} />
                </div>
                <div className="hit-copy">
                  <p className="hit-title">{hit.title}</p>
                  {meta ? <p className="hit-year">{meta}</p> : null}
                </div>
                <RateControl hit={hit} review={review} onOpen={() => setDraft(hit)} />
              </article>
            );
          })}
        </div>
      </div>
      {draft ? (
        <ReviewSheet
          filmTitle={draft.title}
          heading="Write a review"
          initialRating={existing?.rating ?? 0}
          initialBody={existing?.body ?? ""}
          skipLabel={null}
          busy={busy}
          error={sheetError}
          onSave={(rating, body) => void save(rating, body)}
          onSkip={null}
          onClose={() => {
            if (!busy) setDraft(null);
          }}
        />
      ) : null}
    </>
  );
}

const STAR = "M10 1.6l2.4 5.2 5.7.7-4.2 3.9 1.1 5.6L10 14.2 4.9 17l1.1-5.6L1.8 7.5l5.7-.7L10 1.6z";

function hitMeta(hit: SearchHit, review: Review | undefined): string {
  const year = hit.year != null ? String(hit.year) : "";
  if (review && review.rating == null) return year ? `${year} · Seen` : "Seen";
  return year;
}

function RateControl({ hit, review, onOpen }: { hit: SearchHit; review: Review | undefined; onOpen: () => void }) {
  if (review?.rating != null) {
    return (
      <button type="button" className="rate-stars" onClick={onOpen} aria-label={`Rated ${review.rating} of 5. Edit ${hit.title}`}>
        <Stars value={review.rating} />
      </button>
    );
  }
  return (
    <button type="button" className="rate-btn" onClick={onOpen} aria-label={`Rate ${hit.title}`}>
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path fill="currentColor" d={STAR} />
      </svg>
    </button>
  );
}
