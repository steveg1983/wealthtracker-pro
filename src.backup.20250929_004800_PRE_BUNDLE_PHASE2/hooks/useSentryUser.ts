import { useEffect } from 'react';
import { setSentryUser, clearSentryUser } from '../lib/sentry';

interface User {
  id: string;
  email?: string;
  username?: string;
}

export function useSentryUser(user: User | null) {
  useEffect(() => {
    if (user) {
      setSentryUser(user);
    } else {
      clearSentryUser();
    }
  }, [user]);
}