import { useState } from 'react';
import { AuthService } from '@/core/auth/auth.service';

export default function ContractorRegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [registrationCin, setRegistrationCin] = useState('');
  const [gstin, setGstin] = useState('');
  const [contractorClass, setContractorClass] = useState('Class 1 (Unlimited)');
  const [state, setState] = useState('Maharashtra');
  const [district, setDistrict] = useState('Pune');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    setBusy(true);
    setErrorMsg(null);

    try {
      await AuthService.registerContractor({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        companyName: companyName.trim(),
        registrationCin: registrationCin.trim(),
        gstin: gstin.trim(),
        contractorClass,
        state: state.trim(),
        district: district.trim(),
        password,
      });
      setSubmitted(true);
    } catch (err: any) {
      console.error('Contractor registration error:', err);
      setErrorMsg(err.message || 'Onboarding registration failed. Please review your company info.');
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col justify-center items-center px-4 py-12">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            🏢
          </div>
          <h1 className="text-2xl font-bold text-white font-display">Onboarding Application Submitted</h1>
          <p className="text-xs text-slate-400 mt-2">
            Your contractor registration for <strong className="text-slate-200">{companyName}</strong> has been received and logged in the NIRIKSHAK vendor registry.
          </p>
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300 text-left space-y-2">
            <div className="font-bold flex items-center gap-2">
              <span>⏳</span> Status: PENDING VERIFICATION
            </div>
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
              In accordance with government procurement compliance guidelines, contractor privileges (bidding on tenders, receiving contract awards, submitting progress claims) require physical document and GSTIN cross-verification by the Public Works Department authority.
            </p>
          </div>
          <div className="mt-6">
            <a
              href="/contractor/login"
              className="inline-flex items-center justify-center w-full h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Return to Contractor Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/30 text-blue-400 mb-4 shadow-lg shadow-blue-500/10">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-white">Contractor Onboarding</h1>
          <p className="text-xs font-semibold tracking-wider uppercase text-blue-400 mt-1">Vendor Enrolment &amp; Compliance Portal</p>
          <p className="text-xs text-slate-400 mt-1">Register your infrastructure agency for state and municipal procurement</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
          {errorMsg && (
            <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-400 flex items-start gap-2">
              <span className="shrink-0 mt-0.5 font-bold">⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Company / Agency Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sahyadri Infra Projects Ltd"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Authorized Person Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Shinde"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Corporate Email</label>
                <input
                  type="email"
                  required
                  placeholder="tenders@sahyadriinfra.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Phone (+91)</label>
                <input
                  type="tel"
                  required
                  placeholder="9822000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">CIN / Registration No.</label>
                <input
                  type="text"
                  required
                  placeholder="U45200MH2015PTC123456"
                  value={registrationCin}
                  onChange={(e) => setRegistrationCin(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">GSTIN</label>
                <input
                  type="text"
                  required
                  placeholder="27AABCS1429B1Z8"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Contractor Class</label>
                <select
                  value={contractorClass}
                  onChange={(e) => setContractorClass(e.target.value)}
                  className="w-full h-10 px-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                >
                  <option value="Class 1 (Unlimited)">Class 1 (Unlimited)</option>
                  <option value="Class 2 (Up to ₹50 Cr)">Class 2 (Up to ₹50 Cr)</option>
                  <option value="Class 3 (Up to ₹15 Cr)">Class 3 (Up to ₹15 Cr)</option>
                  <option value="Class 4 (Up to ₹5 Cr)">Class 4 (Up to ₹5 Cr)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">State</label>
                <input
                  type="text"
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">District</label>
                <input
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Account Password</label>
                <input
                  type="password"
                  required
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password</label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 mt-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {busy ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting Enrolment Application...</span>
                </>
              ) : (
                'Submit Contractor Enrolment'
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Already registered?</span>
            <a href="/contractor/login" className="font-semibold text-blue-400 hover:text-blue-300 hover:underline">
              Sign In to Portal
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
