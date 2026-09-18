import { supabase } from '@/integrations/supabase/client';

type InvokeResult<T> = { data: T | null };

const CONNECTION_MESSAGE =
  'Could not reach the server tools. Check your connection and try again in a moment.';

/**
 * Invoke an edge function and surface the *real* error message the function
 * returned. `supabase.functions.invoke` only reports "non-2xx status code",
 * hiding the JSON body, so we read the body off the error context.
 */
export async function invokeFunction<T = any>(
  name: string,
  body?: Record<string, unknown>,
): Promise<InvokeResult<T>> {
  const { data, error } = await supabase.functions.invoke(name, body ? { body } : undefined);

  if (error) {
    const context = (error as any)?.context;
    let serverMessage = '';

    if (context && typeof context.json === 'function') {
      try {
        const payload = await context.clone().json();
        serverMessage = payload?.message || payload?.error || '';
      } catch {
        try {
          serverMessage = (await context.clone().text())?.slice(0, 300) || '';
        } catch {
          serverMessage = '';
        }
      }
    }

    if (serverMessage) throw new Error(serverMessage);

    const raw = String(error.message || '');
    if (/Failed to send a request|Failed to fetch|NetworkError/i.test(raw)) {
      throw new Error(CONNECTION_MESSAGE);
    }
    throw new Error(raw || 'The server could not complete this request.');
  }

  const payload = data as any;
  if (payload && typeof payload === 'object' && payload.error) {
    throw new Error(payload.message || payload.error);
  }

  return { data: (data as T) ?? null };
}
