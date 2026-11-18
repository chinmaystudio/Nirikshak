// The government API is always the real Supabase/backend implementation.
// There is no mock implementation and no runtime selection: every surface
// reads authoritative data or renders an honest empty state.
export * from './supabaseApi';
