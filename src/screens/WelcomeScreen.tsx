import { useState } from "react";
import { GoogleButton } from "../components/GoogleButton";
import { Poster } from "../components/Poster";
import { COLLAGE } from "../lib/content";
import { clearGuestReviews } from "../lib/guestMerge";
import { supabase } from "../lib/supabase";

type Props = {
  oauthError?: string;
  accountExists?: boolean;
  onExplore: () => void;
  onResumeGuest?: () => void;
};

export function WelcomeScreen({ oauthError = "", accountExists = false, onExplore, onResumeGuest }: Props) {
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
    clearGuestReviews();
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
        {accountExists ? (
          <p className="lede">This Google account already has your taste. We'll keep that profile and add any new films from this visit.</p>
        ) : null}
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
        <GoogleButton busy={busy === "google"} onClick={() => void google()} />
        {accountExists && onResumeGuest ? (
          <button type="button" className="explore-link" disabled={busy !== null} onClick={onResumeGuest}>
            Back to guest
          </button>
        ) : (
          <>
            <button type="button" className="explore-link" disabled={busy !== null} onClick={() => void explore()}>
              {busy === "explore" ? "Opening…" : "Explore first →"}
            </button>
            <p className="explore-note">No account needed</p>
          </>
        )}
      </div>
    </section>
  );
}
