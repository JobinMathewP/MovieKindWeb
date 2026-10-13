import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Poster } from "../components/Poster";
import { api, errorText } from "../lib/api";
import { toLiked } from "../lib/format";
import { languageName } from "../lib/languages";
import type { Film, LikedFilm, Review, SearchHit } from "../lib/types";

type Props = {
  languages: string[];
  initialLikes: LikedFilm[];
  onDone: (likes: LikedFilm[]) => void;
};

const SWIPE_PX = 80;

export function FirstLikesScreen({ languages, initialLikes, onDone }: Props) {
  const [likes, setLikes] = useState(initialLikes);
  const [languageIndex, setLanguageIndex] = useState(0);
  const [hand, setHand] = useState(0);
  const [deck, setDeck] = useState<SearchHit[]>([]);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [shift, setShift] = useState(0);
  const likesRef = useRef(likes);
  const skippedRef = useRef(skipped);
  const loadSeq = useRef(0);
  const searchSeq = useRef(0);
  const origin = useRef<number | null>(null);
  const dragX = useRef(0);
  likesRef.current = likes;
  skippedRef.current = skipped;

  const language = languages[languageIndex] ?? "";
  const lastLanguage = languageIndex >= languages.length - 1;
  const filled = likes.length >= 5;
  const goal = Math.max((languageIndex + 1) * 5, Math.ceil(likes.length / 5) * 5 || 5);
  const trimmed = query.trim();
  const front = trimmed ? null : (deck[0] ?? null);
  const showSkipForNow = filled && languageIndex > 0 && !lastLanguage;

  useEffect(() => {
    const code = languages[languageIndex];
    if (!code) {
      setDeck([]);
      setExhausted(true);
      return;
    }
    const seq = ++loadSeq.current;
    let cancel = false;
    setLoading(true);
    setExhausted(false);
    const exclude = [...likesRef.current.map((film) => film.tmdbId), ...skippedRef.current];
    const params = new URLSearchParams({ language: code, limit: "10" });
    if (exclude.length > 0) params.set("exclude", exclude.join(","));
    void api<SearchHit[]>(`/films/popular?${params}`)
      .then((hits) => {
        if (cancel || seq !== loadSeq.current) return;
        const seen = new Set(exclude);
        const next = hits.filter((hit) => hit.posterPath && !seen.has(hit.tmdbId));
        if (next.length === 0) {
          if (languageIndex < languages.length - 1) {
            setLanguageIndex(languageIndex + 1);
            return;
          }
          setDeck([]);
          setExhausted(true);
          return;
        }
        setDeck(next);
      })
      .catch((caught) => {
        if (cancel || seq !== loadSeq.current) return;
        setDeck([]);
        setError(errorText(caught));
      })
      .finally(() => {
        if (!cancel && seq === loadSeq.current) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [languageIndex, hand, languages]);

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

  function afterCard(nextLikes: LikedFilm[], rest: SearchHit[]) {
    const crossedFive = likes.length < 5 && nextLikes.length >= 5;
    const moreLanguages = languageIndex < languages.length - 1;
    if (crossedFive && moreLanguages) {
      setDeck([]);
      setLanguageIndex(languageIndex + 1);
      return;
    }
    if (rest.length > 0) return;
    if (nextLikes.length < 5) {
      setHand((value) => value + 1);
      return;
    }
    if (moreLanguages) {
      setDeck([]);
      setLanguageIndex(languageIndex + 1);
      return;
    }
    setExhausted(true);
  }

  async function love(hit: SearchHit) {
    if (pendingId !== null || likes.some((film) => film.tmdbId === hit.tmdbId)) return;
    setPendingId(hit.tmdbId);
    setError("");
    setShift(0);
    origin.current = null;
    try {
      await api<Film>("/films", { method: "POST", body: { tmdbId: hit.tmdbId } });
      const review = await api<Review>("/reviews", {
        method: "PUT",
        body: { tmdbId: hit.tmdbId, rating: 5, body: null },
      });
      const liked = toLiked(review);
      if (!liked) return;
      const next = likes.some((film) => film.tmdbId === liked.tmdbId) ? likes : [...likes, liked];
      setLikes(next);
      const rest = deck.filter((film) => film.tmdbId !== hit.tmdbId);
      setDeck(rest);
      setQuery("");
      afterCard(next, rest);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPendingId(null);
    }
  }

  function skipCard(hit: SearchHit) {
    if (pendingId !== null) return;
    const nextSkipped = skipped.includes(hit.tmdbId) ? skipped : [...skipped, hit.tmdbId];
    setSkipped(nextSkipped);
    skippedRef.current = nextSkipped;
    const rest = deck.filter((film) => film.tmdbId !== hit.tmdbId);
    setDeck(rest);
    setShift(0);
    origin.current = null;
    afterCard(likes, rest);
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

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (pendingId !== null) return;
    origin.current = event.clientX;
    dragX.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (origin.current == null) return;
    const next = event.clientX - origin.current;
    dragX.current = next;
    setShift(next);
  }

  function onPointerUp() {
    if (origin.current == null || !front) return;
    const dx = dragX.current;
    origin.current = null;
    dragX.current = 0;
    setShift(0);
    if (dx >= SWIPE_PX) void love(front);
    else if (dx <= -SWIPE_PX) skipCard(front);
  }

  return (
    <section className="screen">
      <div className="scroll">
        <h1>Add 5 films you love</h1>
        <p className="lede">
          {language
            ? `${languageName(language)} films. Swipe right to love one, or left to skip.`
            : "Search for films you have loved."}
        </p>
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
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
        {trimmed ? (
          <>
            {searching && results.length === 0 ? <p className="kicker">Searching…</p> : null}
            {!searching && results.length === 0 ? <p className="kicker">No films found. Try another title.</p> : null}
            <div className="grid-3">
              {results.map((hit) => {
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
                    <div className="frame">
                      <Poster path={hit.posterPath} title={hit.title} />
                    </div>
                    <p className="caption">{hit.title}</p>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="deck">
            {loading && !front ? <p className="kicker">Finding films…</p> : null}
            {!loading && !front ? (
              <p className="kicker">
                {exhausted && language
                  ? `No more ${languageName(language)} films in this stack. Search for one you love.`
                  : "Search for a film you love."}
              </p>
            ) : null}
            {front ? (
              <>
                <div
                  className={`deck-card${shift > 24 ? " loves" : ""}${shift < -24 ? " skips" : ""}`}
                  style={{ transform: `translateX(${shift}px) rotate(${shift / 18}deg)` }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                >
                  <div className="frame">
                    <Poster path={front.posterPath} title={front.title} size="hero" />
                  </div>
                  <p className="caption deck-title">{front.title}</p>
                </div>
                <div className="deck-actions">
                  <button type="button" className="btn ghost" disabled={pendingId !== null} onClick={() => skipCard(front)}>
                    Skip
                  </button>
                  <button type="button" className="btn gold" disabled={pendingId !== null} onClick={() => void love(front)}>
                    {pendingId === front.tmdbId ? "Saving…" : "Love"}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
      <div className="dock">
        <div className="tray-head">
          <span aria-live="polite">Your picks ({likes.length}/{goal})</span>
        </div>
        {likes.length > 0 ? (
          <div className="tray">
            {likes.map((film) => (
              <div key={film.tmdbId} className="tray-item">
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
        ) : null}
        {showSkipForNow ? (
          <button type="button" className="btn white" onClick={() => onDone(likes)}>
            Skip for now
          </button>
        ) : (
          <button type="button" className="btn gold" disabled={!filled || !lastLanguage} onClick={() => onDone(likes)}>
            {filled && lastLanguage ? "Continue" : `Continue (${likes.length}/${goal})`}
          </button>
        )}
      </div>
    </section>
  );
}
