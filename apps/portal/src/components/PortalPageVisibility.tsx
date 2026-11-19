import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getFirstVisiblePortalPage, getPortalPageForPath, type PortalPageDefinition } from '@moffu/types';
import { supabase } from '@/lib/supabase';

interface VisibilityContextValue {
  visibility: Record<string, boolean>;
  loading: boolean;
  isVisible: (pageKey: string) => boolean;
  firstVisiblePage: PortalPageDefinition;
}

const VisibilityContext = createContext<VisibilityContextValue | null>(null);

export function PortalPageVisibilityProvider({ children }: { children: ReactNode }) {
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const { data, error } = await supabase.from('portal_page_visibility').select('page_key, is_visible');
      if (!active) return;
      // A read outage must not lock customers out of existing portal pages.
      if (!error) {
        setVisibility(Object.fromEntries((data ?? []).map(row => [row.page_key, row.is_visible])));
      }
      setLoading(false);
    };

    void refresh();
    const channel = supabase
      .channel('portal-page-visibility')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'portal_page_visibility' }, () => { void refresh(); })
      .subscribe();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);

    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
      void supabase.removeChannel(channel);
    };
  }, []);

  const value = useMemo<VisibilityContextValue>(() => ({
    visibility,
    loading,
    isVisible: (pageKey: string) => visibility[pageKey] !== false,
    firstVisiblePage: getFirstVisiblePortalPage(visibility),
  }), [visibility, loading]);

  return <VisibilityContext.Provider value={value}>{children}</VisibilityContext.Provider>;
}

export function usePortalPageVisibility() {
  const value = useContext(VisibilityContext);
  if (!value) throw new Error('usePortalPageVisibility must be used inside PortalPageVisibilityProvider');
  return value;
}

export function PortalPageGate({ pageKey, children }: { pageKey: string; children: ReactNode }) {
  const { isVisible, firstVisiblePage, loading } = usePortalPageVisibility();
  const location = useLocation();
  if (!loading && !isVisible(pageKey)) {
    return <Navigate to={firstVisiblePage.path} replace state={{ from: location.pathname, pageHidden: true }} />;
  }
  return <>{children}</>;
}

