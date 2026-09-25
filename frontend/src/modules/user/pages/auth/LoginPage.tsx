import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/common/Icon";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { useNavigate } from "@/app/router";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useT";
import { toast } from "@/hooks/useToast";
import { sendOtp, verifyOtp, DEMO_OTP } from "@/services/auth/authService";
import { isValidMobile, isValidEmail, isValidOtp } from "@/utils/validation";
import { ROUTES } from "@/constants/routes";
import { LANGUAGES, LANGUAGE_ORDER } from "@/constants/i18n";
import type { Language } from "@/types/user";

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const auth = useAuth();
  const next = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("next");
  const decodedNext = next ? decodeURIComponent(next) : null;

  const [mode, setMode] = useState<"mobile" | "email">("mobile");
  const [identity, setIdentity] = useState("");
  const [step, setStep] = useState<"identity" | "otp">("identity");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [expiry, setExpiry] = useState(300);
  const [helpOpen, setHelpOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  const { t } = useT();

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, []);

  const startCountdown = (): void => {
    setResendIn(30);
    setExpiry(300);
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setResendIn((v) => (v <= 1 ? 0 : v - 1));
      setExpiry((v) => (v <= 1 ? 0 : v - 1));
    }, 1000);
  };

  const maskedTarget = (): string =>
    mode === "mobile" && identity.length >= 10 ? `+91 ${identity.slice(0, 2)}XXX XX${identity.slice(8)}` : identity;

  const dispatchOtp = (): void => {
    const valid = mode === "mobile" ? isValidMobile(identity) : isValidEmail(identity);
    if (!valid) {
      toast(mode === "mobile" ? "Enter a valid 10-digit mobile number." : "Enter a valid email address.", "error");
      return;
    }
    setBusy(true);
    void sendOtp(identity)
      .then(() => {
        setStep("otp");
        startCountdown();
        toast("OTP dispatched successfully.", "success");
      })
      .catch((e: Error) => toast(e.message, "error"))
      .finally(() => setBusy(false));
  };

  const verify = (): void => {
    if (!isValidOtp(otp)) {
      setOtpError("Enter the complete 4-digit OTP.");
      return;
    }
    setOtpError(null);
    setBusy(true);
    void verifyOtp(otp, decodedNext)
      .then((res) => {
        toast(`Welcome, ${res.user.name.split(" ")[0]}. Secure login successful.`, "success");
        navigate(res.next ?? ROUTES.HOME);
      })
      .catch((e: Error) => {
        setOtpError(e.message);
        setBusy(false);
      });
  };

  const expiryLabel = `0${Math.floor(expiry / 60)}:${String(expiry % 60).padStart(2, "0")}`;

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => navigate(ROUTES.HOME)} className="inline-flex items-center gap-1.5 text-label-md text-primary hover:text-secondary mb-4 font-semibold">
        <Icon name="arrow_back" className="text-[18px]" /> Back to portal
      </button>
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12">
        <div className="md:col-span-5 bg-primary-container p-8 text-on-primary flex flex-col justify-between">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-on-secondary">
              <Icon name="fingerprint" className="text-[28px]" />
            </div>
            <h2 className="text-headline-md font-headline-md font-bold text-surface-container-lowest">Civic Oversight Identity Gateway</h2>
            <p className="text-body-sm font-body-sm text-surface-variant">
              Login with your verified citizen credentials or mobile OTP to report issues, track complaints and participate in ward-level
              accountability.
            </p>
            <div className="pt-2">
              <label htmlFor="auth-lang" className="block text-label-sm font-label-sm text-surface-variant mb-1">
                Preferred language
              </label>
              <select
                id="auth-lang"
                value={auth.lang}
                onChange={(e) => auth.setLang(e.target.value as Language)}
                className="w-full px-3 py-2 rounded bg-primary-container/60 border border-surface-variant/30 text-body-sm text-surface-container-lowest"
              >
                {LANGUAGE_ORDER.map((lang: Language) => (
                  <option key={lang} value={lang}>
                    {LANGUAGES[lang]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-3 pt-6 border-t border-surface-variant/20 text-label-sm font-label-sm text-surface-variant">
            {["Aadhaar OTP / DigiLocker verification supported", "End-to-end cryptographic audit trail", "Direct linkage to Municipal Commissioner redressal"].map(
              (line) => (
                <div key={line} className="flex items-center gap-2">
                  <Icon name="check_circle" className="text-[16px] text-secondary" />
                  <span>{line}</span>
                </div>
              )
            )}
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

          {step === "identity" ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="login-id" className="block text-label-md font-label-md text-primary mb-1">
                  Registered {mode === "mobile" ? "Mobile Number" : "Email"} <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    id="login-id"
                    type={mode === "mobile" ? "text" : "email"}
                    inputMode={mode === "mobile" ? "numeric" : undefined}
                    maxLength={mode === "mobile" ? 10 : undefined}
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    className={`w-full pl-10 pr-3 py-2 border border-outline-variant rounded focus:ring-2 focus:ring-primary-container focus:border-transparent text-body-md ${
                      mode === "mobile" ? "tracking-wider font-mono" : ""
                    }`}
                    placeholder={mode === "mobile" ? "10-digit mobile number" : "name@example.com"}
                  />
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[20px]">smartphone</span>
                </div>
                <p className="text-label-sm text-outline mt-1">
                  Prefer email?{" "}
                  <button
                    className="text-secondary font-semibold hover:underline"
                    onClick={() => {
                      setMode(mode === "mobile" ? "email" : "mobile");
                      setIdentity(mode === "mobile" ? "aarav.deshmukh@example.in" : "");
                    }}
                  >
                    {mode === "mobile" ? "Login with Email instead" : "Login with Mobile instead"}
                  </button>
                </p>
              </div>
              <label className="flex items-center gap-2 text-body-sm text-on-surface-variant">
                <input type="checkbox" defaultChecked className="rounded text-primary" /> Remember this session on this device
              </label>
              <Button className="w-full" icon="login" size="lg" loading={busy} onClick={dispatchOtp}>
                Send Secure OTP
              </Button>
              <div className="text-center pt-1 space-y-1">
                <button onClick={() => setHelpOpen(true)} className="text-label-sm text-secondary font-bold hover:underline">
                  Login Assistance / Forgot credentials?
                </button>
                <div>
                  <span className="text-body-sm text-on-surface-variant">Authorised government inspector? </span>
                  <button
                    onClick={() => toast("Official SSO is available to authorised government staff via the NIC intranet portal.", "info")}
                    className="text-label-sm text-outline font-semibold underline decoration-dotted"
                  >
                    Official Nodal SSO
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-body-sm text-amber-900 flex items-start gap-2">
                <Icon name="info" className="text-[18px] flex-shrink-0" />
                <span>
                  OTP sent to <strong className="font-mono">{maskedTarget()}</strong>.
                  <span className="block text-label-sm mt-0.5">
                    Demo environment: use OTP <strong className="font-mono">{DEMO_OTP}</strong>. In production this arrives by SMS.
                  </span>
                </span>
              </div>
              <div>
                <label htmlFor="login-otp" className="block text-label-md font-label-md text-primary mb-1">
                  Enter 4-digit OTP <span className="text-error">*</span>
                </label>
                <input
                  id="login-otp"
                  inputMode="numeric"
                  maxLength={4}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full px-3 py-2.5 border border-outline-variant rounded text-center text-headline-md font-mono tracking-[0.6em] focus:ring-2 focus:ring-primary-container focus:border-transparent"
                  placeholder="••••"
                />
              </div>
              <div className="flex items-center justify-between text-label-sm">
                <span className="text-outline">
                  OTP valid for <span className="font-mono font-bold text-primary">{expiryLabel}</span>
                </span>
                <button
                  disabled={resendIn > 0}
                  onClick={dispatchOtp}
                  className="text-secondary font-bold hover:underline disabled:text-outline disabled:no-underline"
                >
                  {resendIn > 0 ? `Resend OTP (${resendIn}s)` : "Resend OTP"}
                </button>
              </div>
              {otpError ? <p className="text-body-sm text-error font-semibold">{otpError}</p> : null}
              <Button className="w-full" icon="verified_user" size="lg" loading={busy} onClick={verify}>
                Verify &amp; Login
              </Button>
              <button
                onClick={() => setStep("identity")}
                className="w-full py-2 border border-outline-variant rounded text-label-md text-on-surface-variant hover:bg-surface-container"
              >
                Change {mode === "mobile" ? "number" : "email"}
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Help & Support">
        <div className="p-5 text-body-md text-on-surface-variant leading-relaxed">
          Toll-free citizen helpdesk: <strong className="text-primary">1800-11-2026</strong> (Mon–Sat, 9 AM–9 PM). Email:
          support@nirikshan.gov.in. For OTP issues, confirm your registered mobile is active and retry after 60 seconds.
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
