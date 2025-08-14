import { useState, useEffect } from 'react';

interface CountdownProps {
  submissionDeadline: string | null;
}

export default function Countdown({ submissionDeadline }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!submissionDeadline) {
      setTimeLeft('Not set');
      return;
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const deadlineTime = new Date(submissionDeadline).getTime();
      const distance = deadlineTime - now;

      if (distance < 0) {
        clearInterval(interval);
        setTimeLeft('Submissions Closed');
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [submissionDeadline]);

  return (
    <div className="countdown">
      <h3>Submissions close in:</h3>
      <p>{timeLeft}</p>
    </div>
  );
}
