import { useEffect, useMemo, useState } from "react";
import { CheckMark, Poster } from "../components/Poster";
import { Stars } from "../components/Stars";
import { languageName } from "../lib/languages";
import type { LikedFilm, Profile } from "../lib/types";

export type HomeTab = "home" | "films" | "profile";

type Props = {
  profile: Profile;
  likes: LikedFilm[];
  tab: HomeTab;
  onTab: (tab: HomeTab) => void;
  onFind: (seeds: LikedFilm[]) => void;
  onNeedFilms: () => void;
  onSignOut: () => void;
};

export function HomeScreen({ profile, likes, tab, onTab, onFind, onNeedFilms, onSignOut }: Props) {
  const [mood, setMood] = useState("All");
  const [picked, setPicked] = useState<number[]>([]);

  useEffect(() => {
    if (tab === "home" && likes.length < 2) onNeedFilms();
  }, [tab, likes.length, onNeedFilms]);

  const genres = useMemo(
    () => [...new Set(likes.flatMap((film) => film.genres))].sort((a, b) => a.localeCompare(b)),
    [likes],
  );
  const visible = mood === "All" ? likes : likes.filter((film) => film.genres.includes(mood));
  const selected = likes.filter((film) => picked.includes(film.tmdbId));

  function toggle(tmdbId: number) {
    setPicked((current) => {
      if (current.includes(tmdbId)) return current.filter((id) => id !== tmdbId);
      if (current.length >= 3) return current;
      return [...current, tmdbId];
    });
  }

  return (
    <section className="screen">
      {tab === "home" && likes.length >= 2 ? (
        <>
          <div className="scroll">
            <h1>What's tonight's mood?</h1>
            <p className="lede">Pick 2-3 films from your liked movies.</p>
            <div className="chip-row scroll-x">
              <button type="button" className="chip" aria-pressed={mood === "All"} onClick={() => setMood("All")}>
                All
              </button>
              {genres.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  className="chip"
                  aria-pressed={mood === genre}
                  onClick={() => setMood(genre)}
                >
                  {genre}
                </button>
              ))}
            </div>
            {visible.length === 0 ? <p className="kicker">No films in this mood.</p> : null}
            <div className="grid-3">
              {visible.map((film) => {
                const on = picked.includes(film.tmdbId);
                return (
                  <button
                    key={film.tmdbId}
                    type="button"
                    className="poster-btn"
                    aria-pressed={on}
                    onClick={() => toggle(film.tmdbId)}
                  >
                    <div className="frame">
                      <Poster path={film.posterPath} title={film.title} />
                      {on ? <CheckMark /> : null}
                    </div>
                    <p className="caption">{film.title}</p>
                    <Stars value={film.rating} label={`You rated this ${film.rating} of 5`} />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="finder">
            <span>Using {selected.length} {selected.length === 1 ? "film" : "films"}</span>
            <button
              type="button"
              className="btn gold"
              disabled={selected.length < 2 || selected.length > 3}
              onClick={() => onFind(selected)}
            >
              Find
            </button>
          </div>
        </>
      ) : null}

      {tab === "films" ? (
        <div className="scroll">
          <h1>My Films</h1>
          <p className="lede">Films you rated 4 or 5.</p>
          {likes.length === 0 ? <p className="kicker">Your loved films will show up here.</p> : null}
          <div className="grid-3">
            {likes.map((film) => (
              <div key={film.tmdbId}>
                <div className="frame">
                  <Poster path={film.posterPath} title={film.title} />
                </div>
                <p className="caption">{film.title}</p>
                <Stars value={film.rating} label={`You rated this ${film.rating} of 5`} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "profile" ? (
        <>
          <div className="scroll profile-copy">
            <div className="initial large" aria-hidden="true">
              {profile.displayName.slice(0, 1).toUpperCase()}
            </div>
            <h1>{profile.displayName}</h1>
            <div className="chip-row">
              {profile.languages.map((code) => (
                <span key={code} className="chip on">
                  {languageName(code)}
                </span>
              ))}
            </div>
          </div>
          <div className="dock">
            <button type="button" className="btn white" onClick={onSignOut}>
              Sign out
            </button>
            <p className="fine">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
          </div>
        </>
      ) : null}

      <nav className="tabs" aria-label="Sections">
        <button type="button" aria-current={tab === "home" ? "page" : undefined} onClick={() => onTab("home")}>
          <HomeIcon />
          Home
        </button>
        <button type="button" aria-current={tab === "films" ? "page" : undefined} onClick={() => onTab("films")}>
          <FilmIcon />
          My Films
        </button>
        <button type="button" aria-current={tab === "profile" ? "page" : undefined} onClick={() => onTab("profile")}>
          <PersonIcon />
          Profile
        </button>
      </nav>
    </section>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="tab-icon" aria-hidden="true">
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FilmIcon() {
  return (
    <svg viewBox="0 0 24 24" className="tab-icon" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="tab-icon" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 19.5c1.4-3 3.7-4.5 6.5-4.5s5.1 1.5 6.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
