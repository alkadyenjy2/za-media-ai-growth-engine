import { supabase, isSupabaseConfigured } from './supabase';

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase authentication is not configured.');
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error('An authenticated session is required for this API request.');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  return fetch(input, { ...init, headers, credentials: 'same-origin' });
}
