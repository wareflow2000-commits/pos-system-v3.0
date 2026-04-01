import { useState, useEffect } from 'react';
import { checkDatabaseHealth } from '../services/dbHealth';

export const useDatabaseStatus = () => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  useEffect(() => {
    const check = async () => {
      const isHealthy = await checkDatabaseHealth();
      setStatus(isHealthy ? 'connected' : 'disconnected');
    };
    check();
    const interval = setInterval(check, 5000); // Check every 5s
    return () => clearInterval(interval);
  }, []);

  return status;
};
