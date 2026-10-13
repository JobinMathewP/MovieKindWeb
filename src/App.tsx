import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { api, ApiError, errorText, setUnauthorizedHandler, wakeServer } from "./lib/api";
import { toLiked } from "./lib/format";
import { currentIsGuest, linkGoogle, suggestedDisplayName, supabase } from "./lib/supabase";
import type { LikedFilm, Profile, Review } from "./lib/types";
import { FirstLikesScreen } from "./screens/FirstLikesScreen";
import { HomeScreen, type HomeTab } from "./screens/HomeScreen";
import { LanguagesScreen } from "./screens/LanguagesScreen";
import { MatchScreen } from "./screens/MatchScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";

type Route =
  | { name: "boot" }
  | { name: "welcome"; message?: string }
  | { name: "languages"; suggestedName: string; guest: boolean }
  | { name: "likes"; profile: Profile; likes: LikedFilm[]; guest: boolean }
  | { name: "home"; profile: Profile; likes: LikedFilm[]; tab: HomeTab; guest: boolean }
  | { name: "match"; profile: Profile; likes: LikedFilm[]; seeds: LikedFilm[]; guest: boolean }
  | { name: "down"; message: string };

export function App() {
  const [route, setRoute] = useState<Route>({ name: "boot" });
  const [slow, setSlow] = useState(false);
  const generation = useRef(0);
  const bootHandled = useRef(false);
  const oauthError = useRef<string | null | undefined>(undefined);

  const toWelcome = useCallback(() => {
    generation.current += 1;
    setRoute({ name: "welcome" });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(toWelcome);
  }, [toWelcome]);

  const enter = useCallback(async () => {
    const gen = ++generation.current;
    setRoute({ name: "boot" });
    setSlow(false);
    try {
      const guest = await currentIsGuest();
      if (gen !== generation.current) return;
      const profile = await api<Profile>("/me");
      if (gen !== generation.current) return;
      const reviews = await api<Review[]>("/me/reviews");
      if (gen !== generation.current) return;
      const likes = reviews.flatMap((review) => {
        const liked = toLiked(review);
        return liked ? [liked] : [];
      });
      if (likes.length < 5) setRoute({ name: "likes", profile, likes, guest });
      else setRoute({ name: "home", profile, likes, tab: "home", guest });
    } catch (error) {
      if (gen !== generation.current) return;
      if (error instanceof ApiError && error.status === 404) {
        const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
        if (gen !== generation.current) return;
        const guest = data.session ? await currentIsGuest() : false;
        if (gen !== generation.current) return;
        setRoute({ name: "languages", suggestedName: suggestedDisplayName(data.session?.user), guest });
        return;
      }
      if (error instanceof ApiError && error.status === 401) {
        setRoute({ name: "welcome" });
        return;
      }
      setRoute({ name: "down", message: errorText(error) });
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    wakeServer();
    const timer = window.setTimeout(() => setSlow(true), 8000);
    let cancelled = false;
    bootHandled.current = false;
    const hasCode = new URLSearchParams(window.location.search).has("code");
    if (oauthError.current === undefined) oauthError.current = oauthReturnError();
    const returnedError = oauthError.current;

    function begin() {
      if (bootHandled.current || cancelled) return;
      bootHandled.current = true;
      stripOAuthQuery();
      window.setTimeout(() => {
        if (!cancelled) void enter();
      }, 0);
    }

    if (returnedError) {
      bootHandled.current = true;
      stripOAuthQuery();
      setRoute({ name: "welcome", message: returnedError });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) begin();
    });

    if (!returnedError) {
      void supabase.auth.getSession().then(({ data }) => {
        if (cancelled || bootHandled.current) return;
        if (data.session) {
          begin();
          return;
        }
        if (!hasCode) bootHandled.current = true;
        stripOAuthQuery();
        setRoute({ name: "welcome" });
      });
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [enter]);

  async function signOut() {
    generation.current += 1;
    try {
      await supabase?.auth.signOut();
    } catch {
      // The account may already be deleted.
    }
    setRoute({ name: "welcome" });
  }

  function applyReview(review: Review) {
    const liked = toLiked(review);
    setRoute((current) => {
      if (current.name !== "home" && current.name !== "match") return current;
      const rest = current.likes.filter((film) => film.tmdbId !== review.tmdbId);
      return { ...current, likes: liked ? [liked, ...rest] : rest };
    });
  }

  let body: ReactNode;
  if (!supabase) {
    body = (
      <section className="screen">
        <div className="scroll center-copy">
          <h1>MovieKind</h1>
          <p className="lede">Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before starting the app.</p>
        </div>
      </section>
    );
  } else if (route.name === "boot") {
    body = (
      <section className="screen">
        <div className="scroll center-copy">
          <p className="lede">Opening MovieKind…</p>
          {slow ? <p className="fine">The server may be waking up. This can take half a minute.</p> : null}
        </div>
      </section>
    );
  } else if (route.name === "down") {
    body = (
      <section className="screen">
        <div className="scroll center-copy">
          <p className="alert" role="alert">
            {route.message}
          </p>
        </div>
        <div className="dock">
          <button type="button" className="btn gold" onClick={() => void enter()}>
            Try again
          </button>
        </div>
      </section>
    );
  } else if (route.name === "welcome") {
    body = (
      <WelcomeScreen
        oauthError={route.message}
        onExplore={() => {
          bootHandled.current = true;
          void enter();
        }}
      />
    );
  } else if (route.name === "languages") {
    body = (
      <LanguagesScreen
        suggestedName={route.suggestedName}
        onSaved={(profile) => setRoute({ name: "likes", profile, likes: [], guest: route.guest })}
      />
    );
  } else if (route.name === "likes") {
    body = (
      <FirstLikesScreen
        initialLikes={route.likes}
        onDone={(likes) => setRoute({ name: "home", profile: route.profile, likes, tab: "home", guest: route.guest })}
      />
    );
  } else if (route.name === "home") {
    body = (
      <HomeScreen
        profile={route.profile}
        likes={route.likes}
        tab={route.tab}
        guest={route.guest}
        onTab={(tab) => setRoute({ ...route, tab })}
        onFind={(seeds) =>
          setRoute({ name: "match", profile: route.profile, likes: route.likes, seeds, guest: route.guest })
        }
        onNeedFilms={() => setRoute({ name: "likes", profile: route.profile, likes: route.likes, guest: route.guest })}
        onReviewed={applyReview}
        onLinkGoogle={linkGoogle}
        onSignOut={() => void signOut()}
        onAccountDeleted={() => void signOut()}
      />
    );
  } else {
    body = (
      <MatchScreen
        seeds={route.seeds}
        guest={route.guest}
        onBack={() => setRoute({ name: "home", profile: route.profile, likes: route.likes, tab: "home", guest: route.guest })}
        onReviewed={applyReview}
        onLinkGoogle={linkGoogle}
      />
    );
  }

  return <div className="app">{body}</div>;
}

const OAUTH_PARAMS = ["code", "state", "error", "error_code", "error_description", "sb_flow_id"];

function oauthReturnError(): string | null {
  const params = new URLSearchParams(window.location.search);
  const description = params.get("error_description");
  const error = params.get("error");
  if (!description && !error) return null;
  return description || error || "Sign-in failed";
}

function stripOAuthQuery() {
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of OAUTH_PARAMS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (!changed) return;
  const search = url.searchParams.toString();
  window.history.replaceState(window.history.state, "", `${url.pathname}${search ? `?${search}` : ""}${url.hash}`);
}
