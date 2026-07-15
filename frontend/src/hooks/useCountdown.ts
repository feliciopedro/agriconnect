import { useState, useEffect } from 'react';

export function useCountdown(expiresAt: string) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    setSecondsLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));

    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;

  const formatted =
    hours > 0
      ? `${hours}h ${String(minutes).padStart(2, '0')}m`
      : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const urgency: 'low' | 'medium' | 'high' | 'critical' =
    secondsLeft > 3600
      ? 'low'
      : secondsLeft > 1800
      ? 'medium'
      : secondsLeft > 300
      ? 'high'
      : 'critical';

  return {
    secondsLeft,
    formatted,
    hours,
    minutes,
    seconds,
    urgency,
    isExpired: secondsLeft <= 0,
  };
}
