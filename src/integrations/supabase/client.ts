import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Backend target. Override these in `.env` to point the app at a different
// Supabase project (see db/README.md).
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://trtuqzdsutmindcjbkvj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_6WHJnH9aYbEnuk8pLCUz3Q_EowZpmTS";


// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Project ref derived from the URL — used for building function URLs.
export const SUPABASE_PROJECT_REF = SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0];
