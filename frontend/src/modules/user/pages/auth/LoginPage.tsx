import { useState } from "react";
import { Icon } from "@/components/common/Icon";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { useNavigate } from "@/app/router";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useT";
import { toast } from "@/hooks/useToast";
import { loginWithEmail } from "@/services/auth/authService";
import { ROUTES } from "@/constants/routes";

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const auth = useAuth();
  const next = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("next");
  const decodedNext = next ? decodeURIComponent(next) : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const { t } = useT();

  const isDev = !import.meta.env.PROD || import.meta.env.VITE_SHOW_DEMO_CREDENTIALS === "true";

  const handleLogin = async (e?: React.FormEvent): Promise<void> => {
    if (e) e.preventDefault();
    if (!email.trim() || !password) {
      toast("Please enter your registered email and password.", "error");
      return;
    }

    setBusy(true);
    setErrorMsg(null);

    try {
      const res = await loginWithEmail(email.trim(), password, decodedNext);
      toast(`Welcome, ${res.user.name.split(" ")[0]}. Secure login successful.`, "success");
      navigate(res.next ?? ROUTES.HOME);
    } catch (err: any) {
      console.error("Citizen login error:", err);
      const msg = err.message || "Invalid credentials. Please verify your email and password.";
      setErrorMsg(msg);
      toast(msg, "error");
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (): void => {
    setEmail("citizen.test@nirikshak.local");
    setPassword("NirikshakCitizen#2026");
    setErrorMsg(null);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => navigate(ROUTES.HOME)} className="inline-flex items-center gap-1.5 text-label-md text-primary hover:text-secondary mb-4 font-semibold cursor-pointer">
        <Icon name="arrow_back" className="text-[18px]" /> Back to portal
      </button>
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12">
        <div className="md:col-span-5 bg-primary-container p-8 text-on-primary flex flex-col justify-between">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-on-secondary">
              <Icon name="fingerprint" className="text-[28px]" />
            </div>
            <h2 className="text-headline-md font-headline-md font-bold text-surface-container-lowest">Civic Oversight Identity Gateway</h2>
            <p className="text-body-md text-on-primary-container leading-relaxed">
              Login with your verified citizen credentials to report issues, track complaints and participate in ward-level public infrastructure audits with full transparency.
            </p>
          </div>

          <div className="space-y-3 pt-6 border-t border-outline-variant/30">
            {[
              { icon: "security", title: "Supabase Auth Security", sub: "Enterprise cryptographic session management" },
              { icon: "verified", title: "Direct Public Audit", sub: "Verify official physical progress directly" },
              { icon: "location_city", title: "Ward-Level Tracking", sub: "Geo-fenced infrastructure grievance logging" }
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <Icon name={f.icon} className="text-secondary text-[20px] mt-0.5" />
                <div>
                  <div className="text-label-md font-bold text-surface-container-lowest">{f.title}</div>
                  <div className="text-label-sm text-on-primary-container">{f.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-7 p-6 md:p-8">
          <div className="flex border-b border-outline-variant mb-6">
            <a href={ROUTES.LOGIN} className="flex-1 pb-3 text-center text-headline-sm font-bold text-primary border-b-2 border-secondary">
              Citizen Login
            </a>
            <a href={ROUTES.REGISTER} className="flex-1 pb-3 text-center text-headline-sm text-on-surface-variant hover:text-primary">
              New Registration
            </a>
          </div>

          {errorMsg && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-body-sm flex items-start gap-2">
              <Icon name="error" className="text-[18px] flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-label-md font-label-md text-primary mb-1">
                Citizen Email Address <span className="text-error">*</span>
              </label>
              <div className="relative">
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-outline-variant rounded focus:ring-2 focus:ring-primary-container focus:border-transparent text-body-md"
                  placeholder="citizen@example.in"
                  autoComplete="email"
                />
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[20px]">mail</span>
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-label-md font-label-md text-primary mb-1">
                Password <span className="text-error">*</span>
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-outline-variant rounded focus:ring-2 focus:ring-primary-container focus:border-transparent text-body-md"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[20px]">lock</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-body-sm text-on-surface-variant cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded text-primary" /> Remember this session
              </label>
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="text-label-sm text-secondary font-bold hover:underline"
              >
                Help &amp; Support
              </button>
            </div>

            <Button className="w-full cursor-pointer" icon="login" size="lg" loading={busy} type="submit">
              Sign In to Citizen Portal
            </Button>
          </form>

          {isDev && (
            <div className="mt-5 rounded-lg border border-outline-variant bg-surface-container p-3.5 text-xs text-on-surface-variant">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-primary flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Demo Citizen Credentials (Dev Only)
                </span>
                <button
                  type="button"
                  onClick={fillDemo}
                  className="text-[11px] font-semibold text-secondary hover:underline bg-secondary/10 px-2 py-0.5 rounded cursor-pointer"
                >
                  Fill Demo
                </button>
              </div>
              <div className="font-mono text-[11px] space-y-0.5">
                <div>Email: <span className="text-primary font-bold">citizen.test@nirikshak.local</span></div>
                <div>Pass: <span className="text-primary font-bold">NirikshakCitizen#2026</span></div>
                <div>Profile: Aarav Deshmukh (Pune Citizen)</div>
              </div>
            </div>
          )}

          <div className="text-center pt-4 text-body-sm text-on-surface-variant">
            Don't have an account yet?{" "}
            <a href={ROUTES.REGISTER} className="text-secondary font-bold hover:underline">
              Register as Citizen
            </a>
          </div>
        </div>
      </div>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Help & Support">
        <div className="p-5 text-body-md text-on-surface-variant leading-relaxed">
          Toll-free citizen helpdesk: <strong className="text-primary">1800-11-2026</strong> (Mon–Sat, 9 AM–9 PM). Email:
          support@nirikshak.gov.in. For login assistance or credentials recovery, contact municipal nodal support.
        </div>
        <div className="px-5 pb-5">
          <Button className="w-full" onClick={() => setHelpOpen(false)}>
            Close
          </Button>
        </div>
      </Modal>
      <span className="hidden">{t("cta.login")}</span>
    </div>
  );
}
