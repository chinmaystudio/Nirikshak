import type { Citizen } from "@/types/user";
import { appStore } from "@/app/providers/store";
import { AuthService } from "@/core/auth/auth.service";
import { supabase } from "@/core/supabase/client";

export interface AuthResult {
  user: Citizen;
  next: string | null;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password?: string;
  mobile?: string;
  preferredLanguage: Citizen["preferredLanguage"];
  city: string;
  ward: string;
}

export function currentUser(): Citizen | null {
  return appStore.getState().user;
}

export function isLoggedIn(): boolean {
  return appStore.getState().user !== null;
}

// Automatically sync citizen state when Supabase session changes
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session?.user) {
      if (appStore.getState().user !== null) {
        appStore.setState({ user: null });
      }
    }
  });
}

/**
 * Synchronizes appStore citizen state with the authoritative Supabase Auth session.
 */
export async function syncCitizenSession(): Promise<Citizen | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) {
    if (appStore.getState().user !== null) {
      appStore.setState({ user: null });
    }
    return null;
  }
  const user = data.session.user;
  const current = appStore.getState().user;
  if (current && current.id === user.id) {
    return current;
  }
  // DF-43: a different account on this browser starts from a clean store.
  if (current && current.id !== user.id) {
    appStore.resetSession();
  }
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  const citizen: Citizen = {
    id: user.id,
    name: profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Citizen',
    email: user.email,
    mobile: profile?.phone || user.user_metadata?.phone || '',
    city: profile?.city || user.user_metadata?.city || '',
    // DF-32: no fabricated fallbacks — unknown ward/city stay empty.
    ward: user.user_metadata?.ward || '',
    preferredLanguage: user.user_metadata?.preferredLanguage || 'en',
    verified: Boolean(user.email_confirmed_at),
    joinedAt: user.created_at ? user.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
  appStore.setState({ user: citizen });
  return citizen;
}

export async function loginWithEmail(email: string, password: string, next: string | null = null): Promise<AuthResult> {
  const session = await AuthService.signIn(email, password);
  const citizen: Citizen = {
    id: session.user.id,
    name: session.profile?.full_name || session.user.email?.split('@')[0] || 'Citizen',
    email: session.user.email,
    // DF-32: no fabricated mobile/ward — use only stored profile/metadata.
    mobile: session.profile?.phone || session.user.user_metadata?.phone || '',
    city: session.profile?.city || '',
    ward: session.user.user_metadata?.ward || '',
    preferredLanguage: session.user.user_metadata?.preferredLanguage || 'en',
    verified: Boolean(session.user.email_confirmed_at),
    joinedAt: session.user.created_at ? session.user.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
  };

  appStore.setState({ user: citizen, next: null });
  const target = next ?? appStore.getState().next ?? "/user/home";
  return { user: citizen, next: target };
}

export async function loginWithGoogle(redirectTo: string = "/user/home"): Promise<void> {
  await AuthService.signInWithGoogle(redirectTo);
}

export async function register(payload: RegisterPayload): Promise<Citizen> {
  // DF-32: never fall back to a hard-coded shared password.
  if (!payload.password) throw new Error('Please set a password for your account.');
  const { user } = await AuthService.signUp({
    email: payload.email,
    password: payload.password,
    fullName: payload.name,
    phone: payload.mobile,
    metadata: {
      ward: payload.ward,
      city: payload.city,
      preferredLanguage: payload.preferredLanguage,
    },
  });

  if (!user?.id) throw new Error('Registration did not return an account. Please try signing in.');

  const citizen: Citizen = {
    id: user.id,
    name: payload.name,
    email: payload.email,
    mobile: payload.mobile || '',
    city: payload.city || '',
    ward: payload.ward,
    preferredLanguage: payload.preferredLanguage,
    verified: Boolean(user?.email_confirmed_at),
    joinedAt: new Date().toISOString().slice(0, 10),
  };

  appStore.setState({ user: citizen, lang: citizen.preferredLanguage });
  return citizen;
}

export async function logout(): Promise<void> {
  await AuthService.signOut();
  appStore.resetSession();
}

export async function updateProfile(patch: Partial<Citizen>): Promise<Citizen> {
  const current = appStore.getState().user;
  if (!current) throw new Error("Not signed in.");

  // DF-32: persist ALL editable fields and propagate failures instead of
  // reporting local success for a write that never landed. profiles has no
  // ward column, so ward lives in the auth user metadata.
  const { error: profileError } = await supabase.from('profiles').update({
    full_name: patch.name ?? current.name,
    phone: patch.mobile ?? current.mobile,
    city: patch.city ?? current.city,
    updated_at: new Date().toISOString(),
  }).eq('id', current.id);
  if (profileError) throw new Error(`Could not save your profile: ${profileError.message}`);

  if (patch.ward !== undefined || patch.preferredLanguage !== undefined) {
    const { error: metaError } = await supabase.auth.updateUser({
      data: {
        ...(patch.ward !== undefined ? { ward: patch.ward } : {}),
        ...(patch.preferredLanguage !== undefined ? { preferredLanguage: patch.preferredLanguage } : {}),
      },
    });
    if (metaError) throw new Error(`Could not save your profile: ${metaError.message}`);
  }

  const updated = { ...current, ...patch };
  appStore.setState({ user: updated });
  return updated;
}
