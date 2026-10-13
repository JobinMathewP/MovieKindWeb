import { GoogleButton } from "./GoogleButton";

type Props = {
  busy: boolean;
  error: string;
  onGoogle: () => void;
  onLater: () => void;
  onClose: () => void;
};

export function KeepSheet({ busy, error, onGoogle, onLater, onClose }: Props) {
  return (
    <div className="sheet-layer" role="presentation" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="keep-heading" onClick={(event) => event.stopPropagation()}>
        <h2 id="keep-heading">Keep this review</h2>
        <p className="sheet-film">Sign in with Google to save it on your account and keep your taste on any device.</p>
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
        <GoogleButton busy={busy} onClick={onGoogle} />
        <button type="button" className="explore-link" disabled={busy} onClick={onLater}>
          Not now
        </button>
      </section>
    </div>
  );
}
