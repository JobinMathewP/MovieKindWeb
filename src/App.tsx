import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { api, ApiError, errorText, setUnauthorizedHandler, wakeServer } from "./lib/api";
import { toLiked } from "./lib/format";
import { supabase } from "./lib/supabase";
import type { LikedFilm, Profile, Review } from "./lib/types";
import { FirstLikesScreen } from "./screens/FirstLikesScreen";
import { HomeScreen, type HomeTab } from "./screens/HomeScreen";
import { LanguagesScreen } from "./screens/LanguagesScreen";
import { MatchScreen } from "./screens/MatchScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";

type Route =
  | { name: "boot" }
  | { name: "welcome" }
  | { name: "languages" }
  | { name: "likes"; profile: Profile; likes: LikedFilm[] }
  | { name: "home"; profile: Profile; likes: LikedFilm[]; tab: HomeTab }
  | { name: "match"; profile: Profile; likes: LikedFilm[]; seeds: LikedFilm[] }
  | { name: "down"; message: string };

export function App() {
  const [route, setRoute] = useState<Route>({ name: "boot" });
  const [slow, setSlow] = useState(false);
  const generation = useRef(0);

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
      const profile = await api<Profile>("/me");
      if (gen !== generation.current) return;
      const reviews = await api<Review[]>("/me/reviews");
      if (gen !== generation.current) return;
      const likes = reviews.flatMap((review) => {
        const liked = toLiked(review);
        return liked ? [liked] : [];
      });
      if (likes.length < 5) setRoute({ name: "likes", profile, likes });
      else setRoute({ name: "home", profile, likes, tab: "home" });
    } catch (error) {
      if (gen !== generation.current) return;
      if (error instanceof ApiError && error.status === 404) {
        setRoute({ name: "languages" });
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
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setRoute({ name: "welcome" });
        return;
      }
      await enter();
    })();
    return () => window.clearTimeout(timer);
  }, [enter]);

  async function signOut() {
    generation.current += 1;
    await supabase?.auth.signOut();
    setRoute({ name: "welcome" });
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
    body = <WelcomeScreen onReady={() => void enter()} />;
  } else if (route.name === "languages") {
    body = (
      <LanguagesScreen
        onSaved={(profile) => setRoute({ name: "likes", profile, likes: [] })}
      />
    );
  } else if (route.name === "likes") {
    body = (
      <FirstLikesScreen
        initialLikes={route.likes}
        onDone={(likes) => setRoute({ name: "home", profile: route.profile, likes, tab: "home" })}
      />
    );
  } else if (route.name === "home") {
    body = (
      <HomeScreen
        profile={route.profile}
        likes={route.likes}
        tab={route.tab}
        onTab={(tab) => setRoute({ ...route, tab })}
        onFind={(seeds) =>
          setRoute({ name: "match", profile: route.profile, likes: route.likes, seeds })
        }
        onNeedFilms={() => setRoute({ name: "likes", profile: route.profile, likes: route.likes })}
        onSignOut={() => void signOut()}
      />
    );
  } else {
    body = (
      <MatchScreen
        seeds={route.seeds}
        onBack={() => setRoute({ name: "home", profile: route.profile, likes: route.likes, tab: "home" })}
      />
    );
  }

  return <div className="app">{body}</div>;
}
