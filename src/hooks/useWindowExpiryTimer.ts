import { useState, useEffect } from "react";

/**
 * Periodically updates a timestamp to trigger live re-evaluations of
 * time-bounded windows (e.g. condition checks, no-show reporting, expiry).
 *
 * @param intervalMs polling frequency in ms (defaults to 30,000ms / 30 seconds)
 */
export function useWindowExpiryTimer(intervalMs: number = 30000): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
