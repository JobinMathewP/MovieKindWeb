import { useState } from "react";
import { Poster } from "../components/Poster";
import { COLLAGE } from "../lib/content";
import { supabase } from "../lib/supabase";

type Props = {
  onReady: () => void;
};

export function WelcomeScreen({ onReady }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"up" | "in" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const ready = email.trim().length > 0 && password.length > 0 && busy === null;

  async function submit(kind: "up" | "in") {
    if (!supabase || !ready) return;
    setBusy(kind);
    setError("");
    setNotice("");
    const credentials = { email: email.trim(), password };
    if (kind === "up") {
      const { data, error: signError } = await supabase.auth.signUp(credentials);
      setBusy(null);
      if (signError) {
        setError(signError.message);
        return;
      }
      if (data.session) {
        onReady();
        return;
      }
      setNotice("Check your email to confirm, then sign in.");
      return;
    }
    const { error: signError } = await supabase.auth.signInWithPassword(credentials);
    setBusy(null);
    if (signError) {
      setError(signError.message);
      return;
    }
    onReady();
  }

  return (
    <section className="screen welcome">
      <div className="collage" aria-hidden="true">
        {COLLAGE.map((film) => (
          <div className="shot frame" key={film.posterPath}>
            <Poster path={film.posterPath} title={film.title} />
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
          Pick a few films you loved. We find people who loved them too and suggest a new movie for tonight.
        </p>
      </div>
      <form
        className="stack welcome-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit("in");
        }}
      >
        <label className="sr-only" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="field"
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label className="sr-only" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          className="field"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="status" role="status">
            {notice}
          </p>
        ) : null}
        <button type="button" className="btn gold" disabled={!ready} onClick={() => void submit("up")}>
          {busy === "up" ? "Creating account…" : "Create account"}
        </button>
        <button type="submit" className="btn white" disabled={!ready}>
          {busy === "in" ? "Signing in…" : "Sign in"}
        </button>
        <p className="fine">Sign in to get started.</p>
      </form>
    </section>
  );
}
