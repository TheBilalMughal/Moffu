import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function usePageTracking() {
  const { pathname } = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    // Skip duplicate fires (StrictMode double-invoke, etc.)
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-pageview`;
      fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: pathname }),
      }).catch(() => {
        // fire-and-forget — never block the UI
      });
    });
  }, [pathname]);
}
