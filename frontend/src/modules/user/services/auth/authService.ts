import type { Citizen } from "@/types/user";
import { ApiError, latency } from "@/services/api/client";
import { appStore } from "@/app/providers/store";

const DEMO_OTP = "1234";

export interface OtpDispatch {
  sent: boolean;
  demoOtp: string;
  target: string;
}

export interface AuthResult {
  user: Citizen;
  next: string | null;
}

export interface RegisterPayload {
  name: string;
  mobile: string;
  email: string;
  preferredLanguage: Citizen["preferredLanguage"];
  city: string;
  ward: string;
}

function demoUser(): Citizen {
  return {
    id: "citizen-0001",
    name: "Aarav Deshmukh",
    mobile: "9876543210",
    email: "aarav.deshmukh@example.in",
    ward: "Ward 12 — Kothrud West",
    city: "Pune",
    preferredLanguage: "en",
    verified: true,
    joinedAt: "2025-06-14"
  };
}

export function currentUser(): Citizen | null {
  return appStore.getState().user;
}

export function isLoggedIn(): boolean {
  return appStore.getState().user !== null;
}

export async function sendOtp(target: string): Promise<OtpDispatch> {
  await latency(600, 1100);
  if (target.replace(/\D/g, "").length < 10) {
    throw new ApiError({ message: "Enter a valid 10-digit mobile number." });
  }
  return { sent: true, demoOtp: DEMO_OTP, target };
}

export async function verifyOtp(code: string, next: string | null): Promise<AuthResult> {
  await latency(500, 900);
  if (code !== DEMO_OTP) {
    throw new ApiError({ message: "Incorrect OTP. Please check the 4-digit code (demo: 1234)." });
  }
  const user = demoUser();
  appStore.setState({ user, next: null });
  const target = next ?? appStore.getState().next ?? "#/home";
  appStore.setState({ next: null });
  return { user, next: target };
}

export async function register(payload: RegisterPayload, code: string): Promise<Citizen> {
  await latency(600, 1000);
  if (code !== DEMO_OTP) {
    throw new ApiError({ message: "Incorrect OTP. Please check the 4-digit code (demo: 1234)." });
  }
  if (!payload.name || !payload.mobile || !payload.ward) {
    throw new ApiError({ message: "Name, mobile number and ward are required." });
  }
  const user: Citizen = {
    id: `citizen-${Date.now()}`,
    name: payload.name,
    mobile: payload.mobile.replace(/\D/g, ""),
    email: payload.email || undefined,
    city: payload.city || "Pune",
    ward: payload.ward,
    preferredLanguage: payload.preferredLanguage,
    verified: true,
    joinedAt: new Date().toISOString().slice(0, 10)
  };
  appStore.setState({ user, lang: user.preferredLanguage });
  return user;
}

export async function logout(): Promise<void> {
  appStore.resetSession();
}

export async function updateProfile(patch: Partial<Citizen>): Promise<Citizen> {
  await latency(350, 650);
  const current = appStore.getState().user;
  if (!current) throw new ApiError({ message: "Not signed in." });
  const updated = { ...current, ...patch };
  appStore.setState({ user: updated });
  return updated;
}

export { DEMO_OTP };
