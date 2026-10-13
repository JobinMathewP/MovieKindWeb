import { useState } from "react";
import { GoogleButton } from "../components/GoogleButton";
import { Poster } from "../components/Poster";
import { COLLAGE } from "../lib/content";
import { supabase } from "../lib/supabase";

type Props = {
  oauthError?: string;
  onExplore: () => void;
};

export function WelcomeScreen({ oauthError = "", onExplore }: Props) {
  const [busy, setBusy] = useState<"google" | "explore" | null>(null);
  const [error, setError] = useState(oauthError);

  async function google() {
    if (!supabase || busy) return;
    setBusy("google");
    setError("");
    const { error: signError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (signError) {
      setBusy(null);
      setError(signError.message);
    }
  }

  async function explore() {
    if (!supabase || busy) return;
    setBusy("explore");
    setError("");
    const { data, error: signError } = await supabase.auth.signInAnonymously();
    if (signError || !data.session) {
      setBusy(null);
      setError(signError?.message || "Guest mode isn't available right now. Continue with Google.");
      return;
    }
    onExplore();
  }

  return (
    <section className="screen welcome">
      <div className="collage" aria-hidden="true">
        {COLLAGE.map((shot) => (
          <div key={shot.posterPath} className="shot">
            <Poster path={shot.posterPath} title={shot.title} />
          </div>
        ))}
      </div>
      <div className="welcome-copy">
        <h1>
          Same taste.
          <br />
          Better picks.
        </h1>
        <p className="lede">
          Pick a few films you loved. We find people who loved them too, and suggest a new movie for tonight.
        </p>
      </div>
      <div className="stack welcome-form">
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
        <GoogleButton busy={busy === "google"} onClick={() => void google()} />
        <button type="button" className="explore-link" disabled={busy !== null} onClick={() => void explore()}>
          {busy === "explore" ? "Opening…" : "Explore first →"}
        </button>
        <p className="explore-note">No account needed</p>
      </div>
    </section>
  );
}
