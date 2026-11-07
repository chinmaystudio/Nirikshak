import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  // Do not throw at module scope: src/main.tsx gates on this configuration and
  // renders a "being configured" card instead, so a misconfigured deploy must
  // not blank-page with an uncaught exception during import.
  console.error(
    '[NIRIKSHAK] VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are not configured; the app will show its configuration screen.'
  );
}

export const supabase = createClient<Database>(supabaseUrl || '', supabaseKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export const isMockApi = import.meta.env.VITE_USE_MOCK_API === 'true';
