import { useState, type FormEvent } from "react";
import { Icon } from "@/components/common/Icon";
import { Button } from "@/components/common/Button";
import { useNavigate } from "@/app/router";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/useToast";
import { sendOtp, register, DEMO_OTP } from "@/services/auth/authService";
import { isValidMobile, isValidEmail } from "@/utils/validation";
import { ROUTES } from "@/constants/routes";
import { WARDS } from "@/constants/issueCategories";
import { LANGUAGES, LANGUAGE_ORDER } from "@/constants/i18n";
import type { Language } from "@/types/user";

export function RegisterPage(): JSX.Element {
  const navigate = useNavigate();
  const auth = useAuth();

  const [step, setStep] = useState<"form" | "otp">("form");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState<Language>(auth.lang);
  const [stateName, setStateName] = useState("Maharashtra");
  const [ward, setWard] = useState<string>(WARDS[0]);
  const [otp, setOtp] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dispatchOtp = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setError(null);
    if (!isValidMobile(mobile)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter a valid email address or leave it blank.");
      return;
    }
    if (name.trim().length < 3) {
      setError("Enter your full name (min 3 characters).");
      return;
    }
    setBusy(true);
    void sendOtp(mobile)
      .then(() => {
        setStep("otp");
        toast("OTP dispatched to your mobile.", "success");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  const createAccount = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }
    if (!/^\d{4}$/.test(otp)) {
      setError("Enter the complete 4-digit OTP.");
      return;
    }
    setBusy(true);
    void register({ name: name.trim(), mobile, email, preferredLanguage: language, city: "Pune", ward }, otp)
      .then((user) => {
        toast(`Registration complete. Welcome to Nirikshan, ${user.name.split(" ")[0]}.`, "success");
        navigate(ROUTES.HOME);
      })
      .catch((err: Error) => {
        setError(err.message);
        setBusy(false);
      });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => navigate(ROUTES.HOME)} className="inline-flex items-center gap-1.5 text-label-md text-primary hover:text-secondary mb-4 font-semibold">
        <Icon name="arrow_back" className="text-[18px]" /> Back to portal
      </button>
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12">
        <div className="md:col-span-5 bg-primary-container p-8 text-on-primary flex flex-col justify-between">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-on-secondary">
              <Icon name="how_to_reg" className="text-[28px]" />
            </div>
            <h2 className="text-headline-md font-headline-md font-bold text-surface-container-lowest">New Citizen Registration</h2>
            <p className="text-body-sm font-body-sm text-surface-variant">
              Verify your mobile number via OTP to create your Nirikshan citizen identity and start reporting with full accountability.
            </p>
          </div>
          <div className="space-y-3 pt-6 border-t border-surface-variant/20 text-label-sm font-label-sm text-surface-variant">
            {["Truthful reporting under PI Disclosure guidelines", "Identity never published on community pages", "Ward-level accountability from day one"].map(
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
            <a href={ROUTES.LOGIN} className="flex-1 pb-3 text-center text-headline-sm text-on-surface-variant hover:text-primary">
              Citizen Login
            </a>
            <a href={ROUTES.REGISTER} className="flex-1 pb-3 text-center text-headline-sm font-bold text-primary border-b-2 border-secondary">
              New Registration
            </a>
          </div>

          {step === "form" ? (
            <form className="space-y-4" onSubmit={dispatchOtp} noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Full Name" required>
                  <input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-outline-variant rounded text-body-md" placeholder="As per Aadhaar" />
                </Field>
                <Field label="Mobile No." required>
                  <input id="reg-mobile" inputMode="numeric" maxLength={10} value={mobile} onChange={(e) => setMobile(e.target.value)} className="w-full px-3 py-2 border border-outline-variant rounded text-body-md font-mono" placeholder="10-digit number" />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Email ID">
                  <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-outline-variant rounded text-body-md" placeholder="name@example.com" />
                </Field>
                <Field label="Preferred Language">
                  <select id="reg-lang" value={language} onChange={(e) => setLanguage(e.target.value as Language)} className="w-full px-3 py-2 border border-outline-variant rounded text-body-md bg-surface-container-lowest">
                    {LANGUAGE_ORDER.map((l) => (
                      <option key={l} value={l}>
                        {LANGUAGES[l]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="State" required>
                  <select id="reg-state" value={stateName} onChange={(e) => setStateName(e.target.value)} className="w-full px-3 py-2 border border-outline-variant rounded text-body-md bg-surface-container-lowest">
                    <option>Maharashtra</option>
                    <option>Karnataka</option>
                    <option>Delhi (NCT)</option>
                    <option>Gujarat</option>
                  </select>
                </Field>
                <Field label="City / Municipal Ward" required>
                  <select id="reg-ward" value={ward} onChange={(e) => setWard(e.target.value)} className="w-full px-3 py-2 border border-outline-variant rounded text-body-md bg-surface-container-lowest">
                    {WARDS.map((w) => (
                      <option key={w}>{w}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-body-sm text-amber-900 flex items-start gap-2">
                <Icon name="info" className="text-[18px] flex-shrink-0" />
                <span>
                  Registration verifies your mobile via OTP.
                  <span className="block text-label-sm mt-0.5">
                    Demo environment: use OTP <strong className="font-mono">{DEMO_OTP}</strong>.
                  </span>
                </span>
              </div>
              {error ? <p className="text-body-sm text-error font-semibold">{error}</p> : null}
              <Button type="submit" variant="accent" className="w-full" size="lg" icon="how_to_reg" loading={busy}>
                Verify Mobile via OTP
              </Button>
              <input type="hidden" value={stateName} />
            </form>
          ) : (
            <form className="space-y-4" onSubmit={createAccount} noValidate>
              <div>
                <label htmlFor="reg-otp" className="block text-label-md font-label-md text-primary mb-1">
                  Enter the 4-digit OTP sent to <span className="font-mono font-bold">+91 {mobile.slice(0, 2)}XXX XX{mobile.slice(8)}</span>
                </label>
                <input
                  id="reg-otp"
                  inputMode="numeric"
                  maxLength={4}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full px-3 py-2.5 border border-outline-variant rounded text-center text-headline-md font-mono tracking-[0.6em]"
                  placeholder="••••"
                />
              </div>
              <label className="flex items-start gap-2 text-body-sm text-on-surface-variant">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 rounded text-primary" />
                <span>
                  I hereby declare that all grievance submissions will be truthful, and I accept the{" "}
                  <span className="text-secondary font-semibold underline">Terms of Service</span> and{" "}
                  <span className="text-secondary font-semibold underline">Privacy Policy</span> under the Public Interest Disclosure guidelines.{" "}
                  <span className="text-error">*</span>
                </span>
              </label>
              {error ? <p className="text-body-sm text-error font-semibold">{error}</p> : null}
              <Button type="submit" className="w-full" size="lg" icon="verified_user" loading={busy}>
                Create Citizen Account
              </Button>
              <button type="button" onClick={() => setStep("form")} className="w-full py-2 border border-outline-variant rounded text-label-md text-on-surface-variant hover:bg-surface-container">
                Edit details
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <span className="block text-label-md font-label-md text-primary mb-1">
        {label}
        {required ? <span className="text-error"> *</span> : null}
      </span>
      {children}
    </div>
  );
}
