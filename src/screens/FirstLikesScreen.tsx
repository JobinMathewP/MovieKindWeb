import { useEffect, useRef, useState } from "react";
import { CheckMark, Poster } from "../components/Poster";
import { api, ApiError, errorText } from "../lib/api";
import { IDEA_QUERIES } from "../lib/content";
import { toLiked } from "../lib/format";
import type { Film, LikedFilm, Review, SearchHit } from "../lib/types";

type Props = {
  initialLikes: LikedFilm[];
  onDone: (likes: LikedFilm[]) => void;
};

export function FirstLikesScreen({ initialLikes, onDone }: Props) {
  const [likes, setLikes] = useState(initialLikes);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [ideas, setIdeas] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [ideasNote, setIdeasNote] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [liftingId, setLiftingId] = useState<number | null>(null);
  const [arrivedId, setArrivedId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const searchSeq = useRef(0);

  const filled = likes.length >= 5;
  const trimmed = query.trim();

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const settled = await Promise.allSettled(
        IDEA_QUERIES.map((idea) => api<SearchHit[]>(`/films/search?q=${encodeURIComponent(idea)}`)),
      );
      if (cancel) return;
      const seen = new Set<number>();
      const next: SearchHit[] = [];
      let note = "";
      for (const item of settled) {
        if (item.status === "rejected") {
          if (!note) note = errorText(item.reason);
          if (item.reason instanceof ApiError && item.reason.status === 429) break;
          continue;
        }
        const hit = item.value[0];
        if (!hit || seen.has(hit.tmdbId)) continue;
        seen.add(hit.tmdbId);
        next.push(hit);
      }
      setIdeas(next);
      if (next.length === 0 && note) setIdeasNote(note);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }
    const handle = window.setTimeout(() => {
      const seq = ++searchSeq.current;
      setSearching(true);
      void api<SearchHit[]>(`/films/search?q=${encodeURIComponent(trimmed)}`)
        .then((hits) => {
          if (seq === searchSeq.current) setResults(hits);
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

  async function love(hit: SearchHit) {
    if (filled || pendingId !== null || likes.some((film) => film.tmdbId === hit.tmdbId)) return;
    setPendingId(hit.tmdbId);
    setLiftingId(hit.tmdbId);
    setError("");
    try {
      await api<Film>("/films", { method: "POST", body: { tmdbId: hit.tmdbId } });
      const review = await api<Review>("/reviews", {
        method: "PUT",
        body: { tmdbId: hit.tmdbId, rating: 5, body: null },
      });
      const liked = toLiked(review);
      if (!liked) return;
      setLikes((current) => {
        if (current.some((film) => film.tmdbId === liked.tmdbId) || current.length >= 5) return current;
        return [...current, liked];
      });
      setArrivedId(liked.tmdbId);
      window.setTimeout(() => setArrivedId((current) => (current === liked.tmdbId ? null : current)), 320);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPendingId(null);
      setLiftingId(null);
    }
  }

  async function remove(tmdbId: number) {
    if (removingId !== null) return;
    setRemovingId(tmdbId);
    setError("");
    try {
      await api<void>(`/reviews/${tmdbId}`, { method: "DELETE" });
      setLikes((current) => current.filter((film) => film.tmdbId !== tmdbId));
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setRemovingId(null);
    }
  }

  const grid = trimmed ? results : ideas;

  return (
    <section className="screen">
      <div className="scroll">
        <h1>{filled ? "Great picks!" : "Add 5 films you love"}</h1>
        <p className="lede">
          {filled
            ? "You've added 5 films. We'll use these to find your first recommendations."
            : "Search for films you've rated 4 or 5 stars. These help us find your first recommendations."}
        </p>
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
        {filled ? (
          <>
            <p className="count" aria-live="polite">
              {likes.length} of 5
            </p>
            <div className="grid-3">
              {likes.map((film) => (
                <div key={film.tmdbId} className={film.tmdbId === arrivedId ? "tray-in" : undefined}>
                  <div className="frame">
                    <Poster path={film.posterPath} title={film.title} />
                    <button
                      type="button"
                      className="x"
                      aria-label={`Remove ${film.title}`}
                      disabled={removingId === film.tmdbId}
                      onClick={() => void remove(film.tmdbId)}
                    >
                      ×
                    </button>
                  </div>
                  <p className="caption">{film.title}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
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
                  setError("");
                  setQuery(event.target.value);
                }}
              />
            </label>
            {trimmed === "" ? <p className="kicker">Type a film name to search.</p> : null}
            {trimmed === "" && ideas.length > 0 ? <p className="kicker">Some ideas to get started</p> : null}
            {trimmed !== "" && searching && results.length === 0 ? <p className="kicker">Searching…</p> : null}
            {trimmed !== "" && !searching && results.length === 0 ? (
              <p className="kicker">No films found. Try another title.</p>
            ) : null}
            {trimmed === "" && ideas.length === 0 && ideasNote ? <p className="alert">{ideasNote}</p> : null}
            <div className="grid-3">
              {grid.map((hit) => {
                const selected = likes.some((film) => film.tmdbId === hit.tmdbId);
                return (
                  <button
                    key={hit.tmdbId}
                    type="button"
                    className="poster-btn"
                    onClick={() => void love(hit)}
                    disabled={pendingId !== null || selected}
                    aria-pressed={selected}
                  >
                    <div className={`frame${liftingId === hit.tmdbId ? " is-lifting" : ""}${pendingId === hit.tmdbId ? " is-pending" : ""}`}>
                      <Poster path={hit.posterPath} title={hit.title} />
                      {selected ? <CheckMark /> : null}
                    </div>
                    <p className="caption">{hit.title}</p>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      {likes.length > 0 && !filled ? (
        <div className="dock">
          <div className="tray-head">
            <span aria-live="polite">{likes.length} of 5</span>
          </div>
          <div className="tray">
            {likes.map((film) => (
              <div key={film.tmdbId} className={`tray-item${film.tmdbId === arrivedId ? " tray-in" : ""}`}>
                <div className="frame">
                  <Poster path={film.posterPath} title={film.title} />
                  <button
                    type="button"
                    className="x"
                    aria-label={`Remove ${film.title}`}
                    disabled={removingId === film.tmdbId}
                    onClick={() => void remove(film.tmdbId)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn gold" disabled>
            Continue ({likes.length}/5)
          </button>
        </div>
      ) : (
        <div className="dock">
          <button type="button" className="btn gold" disabled={!filled} onClick={() => onDone(likes)}>
            {filled ? "Continue" : `Continue (${likes.length}/5)`}
          </button>
        </div>
      )}
    </section>
  );
}
