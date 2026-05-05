import { useEffect, useRef, useState } from 'react';

export function useResendCooldown() {
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);

  function start(seconds: number) {
    setRemaining(seconds);
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
    }
    intervalRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (intervalRef.current !== null) {
            window.clearInterval(intervalRef.current);
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }

  return { remainingSeconds: remaining, isActive: remaining > 0, start };
}
