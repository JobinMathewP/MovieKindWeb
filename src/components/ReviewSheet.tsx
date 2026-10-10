import { useState } from "react";

const STAR = "M10 1.6l2.4 5.2 5.7.7-4.2 3.9 1.1 5.6L10 14.2 4.9 17l1.1-5.6L1.8 7.5l5.7-.7L10 1.6z";

type Props = {
  filmTitle: string;
  heading: string;
  initialRating?: number;
  initialBody?: string;
  skipLabel: string | null;
  busy: boolean;
  error: string;
  onSave: (rating: number, body: string | null) => void;
  onSkip: (() => void) | null;
  onClose: () => void;
};

export function ReviewSheet({
  filmTitle,
  heading,
  initialRating = 0,
  initialBody = "",
  skipLabel,
  busy,
  error,
  onSave,
  onSkip,
  onClose,
}: Props) {
  const [rating, setRating] = useState(initialRating);
  const [body, setBody] = useState(initialBody);
  const text = body.trim();

  return (
    <div className="sheet-layer" role="presentation" onClick={onClose}>
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-heading"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="review-heading">{heading}</h2>
        <p className="sheet-film">{filmTitle}</p>
        <div className="star-picker" role="group" aria-label="Your rating">
          {Array.from({ length: 5 }, (_, index) => {
            const value = index + 1;
            const on = rating >= value;
            return (
              <button
                key={value}
                type="button"
                className={on ? "on" : undefined}
                aria-label={`${value} star${value === 1 ? "" : "s"}`}
                aria-pressed={on}
                onClick={() => setRating(rating === value ? 0 : value)}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path fill="currentColor" d={STAR} />
                </svg>
              </button>
            );
          })}
        </div>
        <label className="sr-only" htmlFor="review-body">
          Share your thoughts, optional
        </label>
        <textarea
          id="review-body"
          className="thoughts"
          maxLength={2000}
          placeholder="Share your thoughts (optional)"
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        {text.length > 0 && rating === 0 ? <p className="kicker">Add a star rating to save the review.</p> : null}
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          className="btn gold"
          disabled={busy || rating < 1}
          onClick={() => onSave(rating, text.length > 0 ? text : null)}
        >
          {busy ? "Saving…" : "Save review"}
        </button>
        {skipLabel && onSkip ? (
          <button type="button" className="text-btn" disabled={busy} onClick={onSkip}>
            {skipLabel}
          </button>
        ) : (
          <button type="button" className="text-btn" disabled={busy} onClick={onClose}>
            Not now
          </button>
        )}
      </section>
    </div>
  );
}
