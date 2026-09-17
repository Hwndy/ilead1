import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Re-runs `refresh` whenever any of the given tables change, and when the tab
 * is brought back into view. Keeps operational screens current without a manual reload.
 */
export function useRealtimeRefresh(tables: string[], refresh: () => void, channelName?: string) {
  const cb = useRef(refresh);
  cb.current = refresh;
  const key = tables.join(',');

  useEffect(() => {
    let timer: number | null = null;
    const debounced = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => cb.current(), 400);
    };

    const channel = supabase.channel(channelName || `refresh-${key}`);
    key.split(',').filter(Boolean).forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, debounced);
    });
    channel.subscribe();

    const onVisible = () => { if (document.visibilityState === 'visible') debounced(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [key, channelName]);
}
