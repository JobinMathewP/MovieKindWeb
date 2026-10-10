import { useState } from "react";
import { api, errorText } from "../lib/api";
import { languageName, PRESET_LANGUAGES } from "../lib/languages";
import type { Profile } from "../lib/types";

type Props = {
  onSaved: (profile: Profile) => void;
};

export function LanguagesScreen({ onSaved }: Props) {
  const [name, setName] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const trimmed = name.trim();
  const canContinue = trimmed.length >= 1 && trimmed.length <= 80 && languages.length > 0 && !busy;
  const initial = trimmed.slice(0, 1).toUpperCase();
  const extras = languages.filter((code) => !PRESET_LANGUAGES.some((language) => language.code === code));

  function toggle(code: string) {
    setError("");
    setLanguages((current) => {
      if (current.includes(code)) return current.filter((item) => item !== code);
      if (current.length >= 20) {
        setError("You can save up to 20 languages");
        return current;
      }
      return [...current, code];
    });
  }

  function commitDraft() {
    const code = draft.trim().toLowerCase();
    setDraft("");
    setAdding(false);
    if (!code) return;
    if (!/^[a-z]{2,3}$/.test(code)) {
      setError("Use a 2 or 3 letter language code");
      return;
    }
    setError("");
    setLanguages((current) => {
      if (current.includes(code)) return current;
      if (current.length >= 20) {
        setError("You can save up to 20 languages");
        return current;
      }
      return [...current, code];
    });
  }

  async function save() {
    if (!canContinue) return;
    setBusy(true);
    setError("");
    try {
      const profile = await api<Profile>("/me", {
        method: "PUT",
        body: { displayName: trimmed, languages },
      });
      onSaved(profile);
    } catch (caught) {
      setError(errorText(caught));
      setBusy(false);
    }
  }

  return (
    <section className="screen">
      <div className="scroll">
        <h1>Almost there!</h1>
        <p className="lede">Select the languages you watch so we can find better matches.</p>
        <p className="kicker">Display name</p>
        <div className="name-field">
          <span className="initial" aria-hidden="true">
            {initial || "·"}
          </span>
          <input
            aria-label="Display name"
            maxLength={80}
            placeholder="Your name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <p className="kicker">Languages you watch</p>
        <div className="chip-row">
          {PRESET_LANGUAGES.map((language) => (
            <button
              key={language.code}
              type="button"
              className="chip"
              aria-pressed={languages.includes(language.code)}
              onClick={() => toggle(language.code)}
            >
              {language.name}
            </button>
          ))}
          {extras.map((code) => (
            <button
              key={code}
              type="button"
              className="chip"
              aria-pressed="true"
              onClick={() => toggle(code)}
            >
              {languageName(code)}
            </button>
          ))}
          {adding ? (
            <input
              className="chip-input"
              autoFocus
              value={draft}
              maxLength={3}
              placeholder="ml"
              aria-label="Language code"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitDraft();
                }
              }}
              onBlur={commitDraft}
            />
          ) : (
            <button type="button" className="chip" onClick={() => setAdding(true)}>
              + Add another
            </button>
          )}
        </div>
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <div className="dock">
        <button type="button" className="btn white" disabled={!canContinue} onClick={() => void save()}>
          {busy ? "Saving…" : "Continue"}
        </button>
      </div>
    </section>
  );
}
