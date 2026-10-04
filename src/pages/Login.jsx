import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { 
  ShieldCheck, 
  Mail, 
  KeyRound, 
  ArrowRight, 
  RotateCw,
  CheckCircle2, 
  AlertCircle,
  Compass,
  MapPin,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiCall, handleApiError } from '../utils/apiCall';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login, user } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('REQUEST_OTP'); // 'REQUEST_OTP' | 'VERIFY_OTP'
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [otpMeta, setOtpMeta] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer;
    if (resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);

  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier) {
      setErrorMsg('Please enter your admin email or phone number');
      return;
    }

    setLoading(true);
    try {
      const response = await apiCall('/api/v1/admin/auth/otp/request', 'POST', {
        identifier: trimmedIdentifier,
        purpose: 'LOGIN',
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data?.message || 'OTP sent successfully to your identifier!');
        if (data?.data) {
          setOtpMeta(data.data);
          if (data.data.identifier) {
            setIdentifier(data.data.identifier);
          }
        }
        setStep('VERIFY_OTP');
        setResendTimer(60);
      } else {
        const errorText = data?.detail || data?.message || 'Failed to send OTP. Please check the identifier.';
        setErrorMsg(typeof errorText === 'string' ? errorText : JSON.stringify(errorText));
        toast.error(typeof errorText === 'string' ? errorText : 'Failed to send OTP');
      }
    } catch (err) {
      console.error('OTP Request Error:', err);
      handleApiError(err, 'Could not reach server. Please verify connection.');
      setErrorMsg('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    const trimmedOtp = otp.trim();
    if (!trimmedOtp) {
      setErrorMsg('Please enter the OTP received');
      return;
    }

    setLoading(true);
    try {
      const response = await apiCall('/api/v1/admin/auth/otp/verify', 'POST', {
        identifier: identifier.trim(),
        otp: trimmedOtp,
        purpose: 'LOGIN',
      });

      const data = await response.json();
      const authPayload = data?.data && typeof data.data === 'object' ? data.data : data;

      if (response.ok && authPayload?.access_token) {
        toast.success(data?.message || 'Authentication successful! Welcome back.');
        await login(authPayload);
        navigate('/dashboard', { replace: true });
      } else {
        const errorText = data?.detail || data?.message || 'Invalid or expired OTP. Please try again.';
        setErrorMsg(typeof errorText === 'string' ? errorText : JSON.stringify(errorText));
        toast.error(typeof errorText === 'string' ? errorText : 'OTP verification failed');
      }
    } catch (err) {
      console.error('OTP Verify Error:', err);
      handleApiError(err, 'Failed to verify OTP.');
      setErrorMsg('Verification error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setErrorMsg('');
    if (!credentialResponse?.credential) {
      toast.error('Google token not received.');
      return;
    }

    setGoogleLoading(true);
    try {
      const response = await apiCall('/api/v1/admin/auth/google', 'POST', {
        id_token: credentialResponse.credential,
      });

      const data = await response.json();
      const authPayload = data?.data && typeof data.data === 'object' ? data.data : data;

      if (response.ok && authPayload?.access_token) {
        toast.success('Signed in with Google successfully!');
        await login(authPayload);
        navigate('/dashboard', { replace: true });
      } else {
        const errorText = data?.detail || data?.message || 'Google authentication failed for admin.';
        setErrorMsg(typeof errorText === 'string' ? errorText : JSON.stringify(errorText));
        toast.error(typeof errorText === 'string' ? errorText : 'Google login error');
      }
    } catch (err) {
      console.error('Google Auth Error:', err);
      handleApiError(err, 'Google authentication service unreachable.');
      setErrorMsg('Google login failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    setGoogleLoading(false);
    toast.error('Google authentication dialog was cancelled or encountered an issue.');
  };

  return (
    <main className="admin-login-page relative flex h-[100dvh] w-full overflow-hidden bg-white selection:bg-teal-200 selection:text-teal-950">
      <section className="admin-login-showcase relative hidden h-full w-[54%] flex-col justify-between overflow-hidden bg-[#092b35] px-12 py-10 text-white lg:flex xl:px-16 xl:py-12">
        <div className="admin-showcase-glow admin-showcase-glow-one" />
        <div className="admin-showcase-glow admin-showcase-glow-two" />
        <div className="admin-showcase-grid" />

        <div className="relative z-10 flex items-center gap-3 admin-enter">
          <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
            <img src="/gantabyaa-transparent.png" alt="" className="h-10 w-10 object-contain" />
          </div>
          <div>
            <p className="text-lg font-extrabold tracking-tight">Gantabyaa</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-teal-200">Travel operations</p>
          </div>
        </div>

        <div className="relative z-10 max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-100/15 bg-white/[0.07] px-3.5 py-2 text-xs font-semibold text-teal-100 backdrop-blur-sm admin-enter admin-enter-delay-one">
            <Sparkles size={14} className="text-amber-300" />
            Your command center for every journey
          </div>
          <h1 className="max-w-xl font-display text-5xl font-extrabold leading-[1.08] tracking-tight xl:text-6xl admin-enter admin-enter-delay-two">
            Make every
            <span className="block bg-gradient-to-r from-teal-200 via-cyan-100 to-amber-200 bg-clip-text text-transparent">journey count.</span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-slate-300/85 xl:text-base xl:leading-7 admin-enter admin-enter-delay-three">
            A calmer way to oversee bookings, travelers and the details that make a great trip.
          </p>

          <div className="relative mt-9 h-44 max-w-lg xl:mt-11 xl:h-52">
            <div className="admin-orbit admin-orbit-one" />
            <div className="admin-orbit admin-orbit-two" />
            <div className="admin-orbit-center"><Compass size={31} strokeWidth={1.4} /></div>
            <div className="admin-map-point admin-map-point-one"><span /><span className="admin-map-label">COOCH BEHAR</span></div>
            <div className="admin-map-point admin-map-point-two"><span /><span className="admin-map-label">YOUR NEXT JOURNEY</span></div>
            <svg className="absolute inset-0 h-full w-full opacity-50" viewBox="0 0 500 210" fill="none" aria-hidden="true">
              <path d="M46 160C104 160 106 56 188 56s77 112 145 112 69-90 128-90" stroke="url(#route)" strokeWidth="1.5" strokeDasharray="5 7" />
              <path d="M24 185c58-8 86-41 119-30s37 28 75 20 58-44 101-36 72 9 130-18" stroke="white" strokeOpacity=".12" />
              <defs><linearGradient id="route" x1="46" y1="105" x2="461" y2="105" gradientUnits="userSpaceOnUse"><stop stopColor="#F6C66A" /><stop offset=".5" stopColor="#75E0D0" /><stop offset="1" stopColor="#D8FBF4" /></linearGradient></defs>
            </svg>
            <div className="absolute bottom-2 left-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
              <span className="h-px w-7 bg-teal-200/60" /> Thoughtfully managed, beautifully explored
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 text-[11px] text-white/45">
          <span>Gantabyaa operations portal</span>
          <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.8)]" />Secure workspace</span>
        </div>
      </section>

      <section className="relative flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden bg-[#f8fafb] px-5 py-5 sm:px-10 lg:px-12">
        <div className="admin-form-glow admin-form-glow-one" />
        <div className="admin-form-glow admin-form-glow-two" />
        <div className="relative z-10 w-full max-w-[410px] admin-form-enter">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
              <img src="/gantabyaa-transparent.png" alt="" className="h-10 w-10 object-contain" />
            </div>
            <div><p className="font-extrabold text-slate-900">Gantabyaa</p><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700">Admin workspace</p></div>
          </div>

          <div className="mb-7">
            <div className="mb-5 hidden h-1 w-12 rounded-full bg-gradient-to-r from-teal-600 to-amber-400 lg:block" />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Welcome back</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-[2.1rem]">
              {step === 'REQUEST_OTP' ? 'Sign in to continue' : 'Check your inbox'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {step === 'REQUEST_OTP'
                ? 'Access your workspace with a secure one-time passcode.'
                : 'Enter the verification code sent to your account.'}
            </p>
          </div>

          {errorMsg && (
            <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              <div className="leading-snug">{errorMsg}</div>
            </div>
          )}

          {step === 'REQUEST_OTP' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label htmlFor="admin-identifier" className="mb-2 block text-xs font-bold text-slate-700">Admin email or phone</label>
                <div className="admin-input-wrap">
                  <Mail className="h-[18px] w-[18px] shrink-0 text-slate-400" />
                  <input
                    id="admin-identifier"
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="name@company.com or mobile"
                    disabled={loading || googleLoading}
                    autoComplete="username"
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-50"
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-400">We’ll send a one-time passcode to verify it’s you.</p>
              </div>

              <button type="submit" disabled={loading || googleLoading} className="admin-submit-button group">
                {loading ? <><RotateCw className="h-4 w-4 animate-spin" /><span>Sending passcode…</span></> : <><span>Continue securely</span><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs text-slate-600">
                <div className="flex min-w-0 items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span className="truncate">{identifier}</span>
                  {otpMeta?.identifier_type && <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-teal-700">{otpMeta.identifier_type}</span>}
                </div>
                <button type="button" onClick={() => { setStep('REQUEST_OTP'); setOtp(''); setErrorMsg(''); setOtpMeta(null); }} disabled={googleLoading} className="shrink-0 font-semibold text-teal-700 hover:text-teal-600 disabled:opacity-50">Change</button>
              </div>
              <div>
                <label htmlFor="admin-otp" className="mb-2 block text-xs font-bold text-slate-700">One-time passcode</label>
                <div className="admin-input-wrap">
                  <KeyRound className="h-[18px] w-[18px] shrink-0 text-slate-400" />
                  <input
                    id="admin-otp"
                    type="text"
                    required
                    maxLength={10}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter your passcode"
                    disabled={loading || googleLoading}
                    autoFocus
                    autoComplete="one-time-code"
                    className="min-w-0 flex-1 bg-transparent font-mono text-sm tracking-[0.2em] text-slate-900 outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 disabled:opacity-50"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Didn’t receive it?</span>
                {resendTimer > 0
                  ? <span className="font-mono text-slate-400">Resend in {resendTimer}s</span>
                  : <button type="button" onClick={handleRequestOtp} disabled={loading || googleLoading} className="font-semibold text-teal-700 hover:text-teal-600 disabled:opacity-50">Resend passcode</button>}
              </div>
              <button type="submit" disabled={loading || googleLoading} className="admin-submit-button admin-submit-button-verify group">
                {loading ? <><RotateCw className="h-4 w-4 animate-spin" /><span>Verifying…</span></> : <><ShieldCheck className="h-4 w-4" /><span>Verify and sign in</span><ArrowRight className="ml-auto h-4 w-4 transition-transform group-hover:translate-x-1" /></>}
              </button>
            </form>
          )}

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Or sign in with</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="flex min-h-[42px] w-full justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="outline"
              shape="pill"
              text="continue_with"
              width="100%"
              disabled={loading || googleLoading}
            />
          </div>

          {googleLoading && <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-500"><RotateCw className="h-3.5 w-3.5 animate-spin text-teal-600" /><span>Waiting for Google…</span></div>}

          <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-200/80 pt-4 text-[11px] text-slate-400">
            <ShieldCheck className="h-4 w-4 shrink-0 text-teal-600" />
            <span>Authorized Gantabyaa personnel only</span>
          </div>
          <p className="mt-4 text-center text-[10px] text-slate-400">
            Protected by secure token verification · © {new Date().getFullYear()} Gantabyaa
          </p>
          <div className="mt-4 hidden items-center justify-center gap-1.5 text-[10px] font-medium text-slate-400 sm:flex">
            <MapPin className="h-3 w-3 text-teal-600" />Thoughtfully managing journeys since 1994
          </div>
        </div>
      </section>
    </main>
  );
};

export default Login;
