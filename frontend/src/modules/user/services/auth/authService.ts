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

export async function loginWithEmail(email: string, password: string, next: string | null = null): Promise<AuthResult> {
  const session = await AuthService.signIn(email, password);
  const citizen: Citizen = {
    id: session.user.id,
    name: session.profile?.full_name || session.user.email?.split('@')[0] || 'Citizen',
    email: session.user.email,
    mobile: session.profile?.phone || '9876543210',
    city: session.profile?.city || 'Pune',
    ward: 'Ward 12 — Kothrud West',
    preferredLanguage: 'en',
    verified: true,
    joinedAt: session.user.created_at ? session.user.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
  };

  appStore.setState({ user: citizen, next: null });
  const target = next ?? appStore.getState().next ?? "#/home";
  return { user: citizen, next: target };
}

export async function register(payload: RegisterPayload): Promise<Citizen> {
  const password = payload.password || 'NirikshakCitizen#2026';
  const { user } = await AuthService.signUp({
    email: payload.email,
    password,
    fullName: payload.name,
    phone: payload.mobile,
    role: 'citizen',
    metadata: {
      ward: payload.ward,
      city: payload.city,
      preferredLanguage: payload.preferredLanguage,
    },
  });

  const citizen: Citizen = {
    id: user?.id || `citizen-${Date.now()}`,
    name: payload.name,
    email: payload.email,
    mobile: payload.mobile || '',
    city: payload.city || 'Pune',
    ward: payload.ward,
    preferredLanguage: payload.preferredLanguage,
    verified: true,
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
  
  if (current.id) {
    await supabase.from('profiles').update({
      full_name: patch.name ?? current.name,
      phone: patch.mobile ?? current.mobile,
      city: patch.city ?? current.city,
      updated_at: new Date().toISOString(),
    }).eq('id', current.id);
  }

  const updated = { ...current, ...patch };
  appStore.setState({ user: updated });
  return updated;
}
