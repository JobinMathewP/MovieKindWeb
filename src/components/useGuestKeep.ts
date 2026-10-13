import { useRef, useState } from "react";
import { errorText } from "../lib/api";

const PROMPTED = "mk-guest-prompted";

export function useGuestKeep(guest: boolean, onLink: () => Promise<void>) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<(() => Promise<void>) | null>(null);

  function ask(action: () => Promise<void>) {
    if (!guest || sessionStorage.getItem(PROMPTED) === "1") {
      void action().catch(() => undefined);
      return;
    }
    pending.current = action;
    setError("");
    setOpen(true);
  }

  function close() {
    if (busy) return;
    pending.current = null;
    setOpen(false);
  }

  async function later() {
    sessionStorage.setItem(PROMPTED, "1");
    setOpen(false);
    const action = pending.current;
    pending.current = null;
    if (action) await action().catch(() => undefined);
  }

  async function google() {
    setBusy(true);
    setError("");
    try {
      const action = pending.current;
      pending.current = null;
      if (action) await action();
      sessionStorage.setItem(PROMPTED, "1");
      await onLink();
    } catch (caught) {
      setError(errorText(caught));
      setBusy(false);
    }
  }

  return { open, busy, error, ask, close, later, google };
}
