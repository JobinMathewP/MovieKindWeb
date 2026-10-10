import { useEffect, useState } from "react";
import { Poster } from "../components/Poster";
import { ReviewSheet } from "../components/ReviewSheet";
import { Stars } from "../components/Stars";
import { api, errorText } from "../lib/api";
import { downloadBlob, renderCardPng } from "../lib/cardImage";
import { formatRuntime, lovedSentence, metaLine, prefersReducedMotion } from "../lib/format";
import { saveReview } from "../lib/reviews";
import type { Film, LikedFilm, Recommendation, Review } from "../lib/types";

type Props = {
  seeds: LikedFilm[];
  onBack: () => void;
  onReviewed: (review: Review) => void;
};

type Phase = "wait" | "reveal" | "show";
type Panel = "result" | "share";
type SavedReview = { rating: number; body: string | null };

export function MatchScreen({ seeds, onBack, onReviewed }: Props) {
  const seedKey = seeds.map((seed) => seed.tmdbId).join(",");
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>("wait");
  const [results, setResults] = useState<Recommendation[]>([]);
  const [index, setIndex] = useState(0);
  const [panel, setPanel] = useState<Panel>("result");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [slow, setSlow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saved, setSaved] = useState<Record<number, SavedReview>>({});
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, Film>>({});

  useEffect(() => {
    const ctrl = new AbortController();
    let gone = false;
    let timer = 0;
    setPhase("wait");
    setLoadError("");
    setActionError("");
    setResults([]);
    setIndex(0);
    setPanel("result");
    setReviewOpen(false);
    setSaved({});
    setChosenId(null);
    setSlow(false);
    void (async () => {
      try {
        const rows = await api<Recommendation[]>("/recommendations", {
          method: "POST",
          body: { tmdbIds: seeds.map((seed) => seed.tmdbId) },
          signal: ctrl.signal,
        });
        if (gone) return;
        setResults(rows);
        if (rows.length === 0 || prefersReducedMotion()) setPhase("show");
        else {
          setPhase("reveal");
          timer = window.setTimeout(() => {
            if (!gone) setPhase("show");
          }, 800);
        }
      } catch (caught) {
        if (gone || (caught instanceof DOMException && caught.name === "AbortError")) return;
        setLoadError(errorText(caught));
      }
    })();
    return () => {
      gone = true;
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [seedKey, attempt, seeds]);

  useEffect(() => {
    if (phase !== "wait" || loadError) return;
    const timer = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(timer);
  }, [phase, loadError, attempt]);

  const current = results[index];

  useEffect(() => {
    if (!current) return;
    let cancel = false;
    void api<Film>("/films", { method: "POST", body: { tmdbId: current.tmdbId } })
      .then((film) => {
        if (!cancel) setDetails((prev) => ({ ...prev, [film.tmdbId]: film }));
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [current]);

  const sentence = lovedSentence(
    current?.matchCount ?? 0,
    seeds.map((seed) => seed.title),
  );

  if (phase !== "show" || loadError) {
    return (
      <Finding
        seeds={seeds}
        reveal={phase === "reveal" ? (loadError ? null : results[0]) : null}
        error={loadError}
        slow={slow && !loadError}
        onBack={onBack}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  }

  if (!current) {
    return (
      <section className="screen">
        <div className="scroll center-copy">
          <h1>No one else has loved these films yet</h1>
        </div>
        <div className="dock">
          <button type="button" className="btn gold" onClick={onBack}>
            Change tonight's films
          </button>
        </div>
      </section>
    );
  }

  if (panel === "share") {
    return (
      <ShareCard
        film={current}
        seeds={seeds}
        sentence={sentence}
        onBack={() => setPanel("result")}
      />
    );
  }

  const detail = details[current.tmdbId];
  const runtime = formatRuntime(detail?.runtimeMinutes ?? null);

  const mine = saved[current.tmdbId];
  const chosen = chosenId === current.tmdbId;
  const people =
    current.matchCount === 1 ? "1 person who loved the same films as you" : `${current.matchCount} people who loved the same films as you`;

  async function commitSeen(rating: number | null, text: string | null) {
    setBusy(true);
    setActionError("");
    try {
      const review = await saveReview(current.tmdbId, rating, text);
      onReviewed(review);
      setReviewOpen(false);
      if (rating == null) {
        setIndex((value) => value + 1);
      } else {
        setSaved((prev) => ({ ...prev, [current.tmdbId]: { rating, body: text } }));
      }
    } catch (caught) {
      setActionError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="screen">
      <div className="topbar split">
        <button type="button" className="back" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <button type="button" className="icon-btn" aria-label="Share" onClick={() => setPanel("share")}>
          <ShareIcon />
        </button>
      </div>
      <div className="scroll pick-scroll">
        <h1 className="pick-lead">{index === 0 ? "Your movie for tonight." : "Another great pick for tonight."}</h1>
        <p className="pick-based">Based on {people}.</p>
        <div className="frame result-hero">
          <Poster path={current.posterPath} title={current.title} size="hero" />
        </div>
        <h2 className="result-title">{current.title}</h2>
        <p className="meta">{metaLine(current.year, current.genres.slice(0, 3), runtime)}</p>
        <div className="score-row">
          <Stars value={current.averageRating} label={`Average rating ${current.averageRating} of 5`} />
          <span className="score-num">{formatScore(current.averageRating)}</span>
        </div>
        {detail?.overview ? <p className="overview">{detail.overview}</p> : null}
        {current.genres.length > 0 ? (
          <div className="tag-row">
            {current.genres.map((genre) => (
              <span key={genre} className="tag">
                {genre}
              </span>
            ))}
          </div>
        ) : null}
        <div className="evidence">
          <h3>Loved by people who also loved</h3>
          <div className="seed-row">
            {seeds.map((seed) => (
              <div key={seed.tmdbId} className="seed-card">
                <div className="frame">
                  <Poster path={seed.posterPath} title={seed.title} />
                </div>
                <p className="caption">{seed.title}</p>
              </div>
            ))}
          </div>
        </div>
        {mine ? (
          <div className="saved-review">
            <div className="saved-head">
              <p>Your review saved</p>
              <button type="button" onClick={() => setReviewOpen(true)}>
                Edit
              </button>
            </div>
            <Stars value={mine.rating} label={`You rated this ${mine.rating} of 5`} />
            {mine.body ? <p>{mine.body}</p> : null}
          </div>
        ) : null}
        {actionError && !reviewOpen ? (
          <p className="alert" role="alert">
            {actionError}
          </p>
        ) : null}
      </div>
      <div className="dock pick-actions">
        <button
          type="button"
          className="pick-side"
          disabled={busy}
          onClick={() => {
            setActionError("");
            setReviewOpen(false);
            setIndex((value) => value + 1);
          }}
        >
          <PassIcon />
          Not for me
        </button>
        <button
          type="button"
          className="pick-side"
          disabled={busy}
          onClick={() => {
            setActionError("");
            setReviewOpen(true);
          }}
        >
          <SeenIcon />
          Seen it
        </button>
        <button
          type="button"
          className={chosen ? "btn gold pick-choose is-on" : "btn gold pick-choose"}
          aria-pressed={chosen}
          disabled={busy}
          onClick={() => setChosenId(chosen ? null : current.tmdbId)}
        >
          {chosen ? "Chosen for tonight" : "I'll watch this"}
        </button>
      </div>
      {reviewOpen ? (
        <ReviewSheet
          filmTitle={current.title}
          heading="How would you rate it?"
          initialRating={mine?.rating ?? 0}
          initialBody={mine?.body ?? ""}
          skipLabel="Skip for now"
          busy={busy}
          error={actionError}
          onSave={(rating, text) => void commitSeen(rating, text)}
          onSkip={() => void commitSeen(null, null)}
          onClose={() => {
            if (!busy) setReviewOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}

function formatScore(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v11" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 12.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-6.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PassIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 12h8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function SeenIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function Finding({
  seeds,
  reveal,
  error,
  slow,
  onBack,
  onRetry,
}: {
  seeds: LikedFilm[];
  reveal: Recommendation | null;
  error: string;
  slow: boolean;
  onBack: () => void;
  onRetry: () => void;
}) {
  const layout = seeds.length >= 3 ? "spots-3" : "spots-2";
  return (
    <section className={`finding${reveal ? " reveal" : ""}`}>
      <div className="topbar">
        <button type="button" className="back" onClick={onBack} aria-label="Back">
          ‹
        </button>
      </div>
      <div className={`stage${reveal ? " reveal" : ""}`}>
        {seeds.map((seed, index) => {
          return (
            <div key={seed.tmdbId} className={`seed-float frame ${layout} n${index}`}>
              <Poster path={seed.posterPath} title={seed.title} />
            </div>
          );
        })}
        {reveal ? (
          <div className="result-rise frame">
            <Poster path={reveal.posterPath} title={reveal.title} size="hero" />
          </div>
        ) : null}
      </div>
      <p className="finding-label">Finding your match...</p>
      {slow ? <p className="fine">The server may be waking up. This can take half a minute.</p> : null}
      {error ? (
        <div className="dock">
          <p className="alert" role="alert">
            {error}
          </p>
          <button type="button" className="btn gold" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : null}
    </section>
  );
}

function ShareCard({
  film,
  seeds,
  sentence,
  onBack,
}: {
  film: Recommendation;
  seeds: LikedFilm[];
  sentence: string;
  onBack: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function png() {
    return renderCardPng({
      title: film.title,
      year: film.year,
      sentence,
      seeds: seeds.map((seed) => seed.title),
    });
  }

  async function share() {
    setBusy(true);
    setError("");
    try {
      const blob = await png();
      const file = new File([blob], "moviekind-pick.png", { type: "image/png" });
      if (typeof navigator.share === "function") {
        const withFile = { files: [file], title: film.title, text: sentence };
        try {
          if (navigator.canShare?.(withFile)) await navigator.share(withFile);
          else await navigator.share({ title: film.title, text: sentence });
        } catch (caught) {
          if (caught instanceof DOMException && caught.name === "AbortError") return;
          throw caught;
        }
        return;
      }
      downloadBlob(blob, "moviekind-pick.png");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      downloadBlob(await png(), "moviekind-pick.png");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="screen">
      <div className="topbar">
        <button type="button" className="back" onClick={onBack} aria-label="Back">
          ‹
        </button>
      </div>
      <div className="scroll share-scroll">
        <article className="share-card">
          <div className="share-hero">
            <Poster path={film.posterPath} title={film.title} size="hero" />
            <div className="share-fade">
              <p className="share-kicker">My next movie pick</p>
              <h2>{film.title}</h2>
              {film.year != null ? <p className="share-year">{film.year}</p> : null}
              <p>{sentence}</p>
            </div>
          </div>
          <div className="share-seeds">
            {seeds.map((seed) => (
              <div key={seed.tmdbId} className="frame">
                <Poster path={seed.posterPath} title={seed.title} />
              </div>
            ))}
          </div>
          <p className="share-brand">Same taste. Better picks.</p>
        </article>
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <div className="dock">
        <button type="button" className="btn gold" disabled={busy} onClick={() => void share()}>
          Share
        </button>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => void save()}>
          Save image
        </button>
      </div>
    </section>
  );
}
