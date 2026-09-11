import { useEffect, useRef } from "react";
import type { AutoLockMinutes } from "./types";

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousedown",
  "mousemove",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
];

// mousemove fires dozens of times a second; only use it to prove "the human
// is here", not to reset the timer on every pixel. Everything else resets
// immediately since it's a deliberate action.
const THROTTLE_MS = 1000;

/**
 * Resets a per-user inactivity timer on real interaction and calls
 * onTimeout() once the configured window elapses. `minutes === null` means
 * "Nunca" and disables the timer entirely. This hook only ever calls
 * onTimeout — it never closes a window or blocks the UI itself, so the
 * caller decides what "session closed" means (return to user selection).
 */
export function useSessionTimer(minutes: AutoLockMinutes, active: boolean, onTimeout: () => void) {
  const timeoutRef = useRef<number | undefined>(undefined);
  const lastResetRef = useRef(0);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!active || minutes === null || minutes === undefined) {
      window.clearTimeout(timeoutRef.current);
      return;
    }

    const durationMs = minutes * 60_000;

    const arm = () => {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        onTimeoutRef.current();
      }, durationMs);
    };

    const handleActivity = (event: Event) => {
      const now = Date.now();
      if (event.type === "mousemove" && now - lastResetRef.current < THROTTLE_MS) {
        return;
      }
      lastResetRef.current = now;
      arm();
    };

    arm();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    return () => {
      window.clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  }, [minutes, active]);
}
