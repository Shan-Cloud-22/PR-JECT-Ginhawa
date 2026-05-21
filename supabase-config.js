import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ── REPLACE THESE TWO VALUES ──────────────────────────────
const SUPABASE_URL  = 'https://xgtrlxyaibwfaoplqabe.supabase.co';
const SUPABASE_ANON = 'sb_publishable_rC5LEChDSueTHtZnM4AH8A_M1nphvTA';
// ─────────────────────────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// Storage bucket name (must match what you created in the Dashboard)
export const IMAGE_BUCKET = 'item-images';

// Convenience: get the currently signed-in user (or null)
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Convenience: get profile row for a given user id
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

// Redirect to login if the visitor is not authenticated.
// Call this at the top of any protected page (dashboard, all-items).
export async function requireAuth(redirectTo = '../pages/login.html') {
  const user = await getCurrentUser();
  if (!user) window.location.href = redirectTo;
  return user;
}
