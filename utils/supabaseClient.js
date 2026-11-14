import { createClient } from '@supabase/supabase-js';

let cachedClient;
let signupVerification;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseClientKey = supabaseAnonKey;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseClientKey);
}

export function getSupabaseRestConfig() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  return {
    url: supabaseUrl,
    key: supabaseClientKey
  };
}

export function getSignupVerification() {
  return signupVerification ?? Promise.resolve({ status: 'no-link' });
}

export function clearSignupVerification() {
  signupVerification = undefined;
}

const CALLBACK_FIELDS = ['access_token', 'code', 'type', 'token_hash'];
const CALLBACK_ERRORS = ['error', 'error_code', 'error_description'];

function readSignupCallback(url) {
  const params = new URLSearchParams(url.hash.slice(1));
  for (const [key, value] of url.searchParams) params.set(key, value);
  if (CALLBACK_ERRORS.some(key => params.has(key))) return { status: 'invalid' };
  if (!CALLBACK_FIELDS.some(key => params.has(key))) return { status: 'no-link' };
  const accessToken = params.get('access_token');
  if (params.get('type') !== 'signup' || !accessToken) return { status: 'invalid' };
  return { status: 'pending', accessToken };
}

async function checkSignupVerification(auth, url) {
  const callback = readSignupCallback(url);
  if (callback.status !== 'pending') return callback;
  const initialized = await auth.initialize();
  if (initialized.error) return { status: 'invalid' };
  const { data, error } = await auth.getSession();
  const session = data?.session;
  if (error || !isConfirmedSignupSession(session, callback.accessToken)) return { status: 'invalid' };
  return { status: 'confirmed', userId: session.user.id };
}

function isConfirmedSignupSession(session, accessToken) {
  return session?.access_token === accessToken && Boolean(session.user?.email_confirmed_at);
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured() || typeof window === 'undefined') {
    return null;
  }

  if (!cachedClient) {
    const initialUrl = new URL(window.location.href);
    cachedClient = createClient(supabaseUrl, supabaseClientKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    if (initialUrl.pathname === '/verify') {
      signupVerification = checkSignupVerification(cachedClient.auth, initialUrl)
        .catch(() => ({ status: 'invalid' }));
    }
  }

  return cachedClient;
}
