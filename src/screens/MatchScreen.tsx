import { useEffect, useState } from "react";
import { Poster } from "../components/Poster";
import { Stars } from "../components/Stars";
import { api, ApiError, errorText } from "../lib/api";
import { downloadBlob, renderCardPng } from "../lib/cardImage";
import { formatRuntime, initials, lovedSentence, metaLine, prefersReducedMotion } from "../lib/format";
import type { Film, LikedFilm, Recommendation } from "../lib/types";

type Props = {
  seeds: LikedFilm[];
  onBack: () => void;
};

type Phase = "wait" | "reveal" | "show";
type Panel = "result" | "why" | "share";

export function MatchScreen({ seeds, onBack }: Props) {
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

  if (panel === "why") {
    return <WhyMatch film={current} seeds={seeds} onBack={() => setPanel("result")} />;
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

  async function seenIt() {
    setBusy(true);
    setActionError("");
    try {
      await saveSeen(current.tmdbId);
      setIndex((value) => value + 1);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400 && /film not found/i.test(caught.message)) {
        try {
          await api<Film>("/films", { method: "POST", body: { tmdbId: current.tmdbId } });
          await saveSeen(current.tmdbId);
          setIndex((value) => value + 1);
          return;
        } catch (retryError) {
          setActionError(errorText(retryError));
          return;
        }
      }
      setActionError(errorText(caught));
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
      <div className="scroll result-scroll">
        <div className="frame result-hero">
          <Poster path={current.posterPath} title={current.title} size="hero" />
        </div>
        <h2 className="result-title">{current.title}</h2>
        <p className="meta">{metaLine(current.year, current.genres, runtime)}</p>
        <div className="star-row">
          <Stars value={current.averageRating} label={`Average rating ${current.averageRating}`} />
        </div>
        <button type="button" className="loved" onClick={() => setPanel("why")}>
          {sentence}
        </button>
        {detail?.overview ? <p className="overview">{detail.overview}</p> : null}
        {actionError ? (
          <p className="alert" role="alert">
            {actionError}
          </p>
        ) : null}
      </div>
      <div className="dock action-row">
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() => {
            setActionError("");
            setIndex((value) => value + 1);
          }}
        >
          Not for me
        </button>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => void seenIt()}>
          Seen it
        </button>
        <button type="button" className="btn gold" disabled={busy} onClick={() => setPanel("share")}>
          Share
        </button>
      </div>
    </section>
  );
}

function saveSeen(tmdbId: number) {
  return api("/reviews", {
    method: "PUT",
    body: { tmdbId, rating: null, body: null },
  });
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

function WhyMatch({
  film,
  seeds,
  onBack,
}: {
  film: Recommendation;
  seeds: LikedFilm[];
  onBack: () => void;
}) {
  const names = film.matchNames.map((name) => name.trim()).filter(Boolean);
  const extra = Math.max(0, film.matchCount - names.length);
  return (
    <section className="screen">
      <div className="topbar">
        <button type="button" className="back" onClick={onBack} aria-label="Back">
          ‹
        </button>
      </div>
      <div className="scroll">
        <h1>Why this match?</h1>
        <p className="lede">{film.matchCount} people also rated these films 4 or 5.</p>
        <div className="avatar-row">
          {names.map((name, nameIndex) => (
            <span key={`${name}-${nameIndex}`} className="avatar" title={name}>
              {initials(name)}
            </span>
          ))}
          {extra > 0 ? <span className="avatar more">+{extra}</span> : null}
        </div>
        <p className="kicker">Films in common</p>
        <div className="seed-row">
          {seeds.map((seed) => (
            <div key={seed.tmdbId} className="seed-card">
              <div className="frame">
                <Poster path={seed.posterPath} title={seed.title} />
              </div>
              <p className="caption">{seed.title}</p>
              <Stars value={seed.rating} label={`You rated this ${seed.rating} of 5`} />
            </div>
          ))}
        </div>
      </div>
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
