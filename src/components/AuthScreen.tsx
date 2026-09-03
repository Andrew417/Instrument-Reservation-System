import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext.tsx";
import {
  Lock,
  Mail,
  Phone,
  User,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  KeyRound,
  AlertTriangle,
  Clock,
  X,
  Church,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";

export const AuthScreen: React.FC = () => {
  const {
    loginWithEmail,
    registerWithEmail,
    error,
    clearError,
    isLocked,
    lockRemainingSeconds,
  } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Forgot Password Modal State
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [resetStep, setResetStep] = useState<
    "request" | "verify" | "new_password" | "success"
  >("request");
  const [resetEmail, setResetEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [testModeActive, setTestModeActive] = useState(false);
  const [simulatedCode, setSimulatedCode] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [registrationNotice, setRegistrationNotice] = useState<string | null>(
    null,
  );
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Countdown timer for OTP resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || isLocked) return;
    setSubmitting(true);
    try {
      if (mode === "login") {
        await loginWithEmail(email, password);
      } else {
        const res = await registerWithEmail(name, email, phoneNumber, password);
        if (res && res.pendingApproval) {
          setRegistrationNotice(
            res.message ||
              "Your account is awaiting admin approval before you can log in.",
          );
          setMode("login");
          setPassword("");
        }
      }
    } catch {
      // Error handled and captured in AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  const openForgotPassword = () => {
    setResetEmail(email || "");
    setResetStep("request");
    setOtpCode("");
    setTestModeActive(false);
    setSimulatedCode(null);
    setResetToken(null);
    setNewPassword("");
    setConfirmPassword("");
    setResetError(null);
    setResendCooldown(0);
    setShowForgotPasswordModal(true);
  };

  // Step 1: Request OTP by Email
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!resetEmail) return;
    setResetLoading(true);
    setResetError(null);

    try {
      const res = await fetch("/api/auth/forgot-password/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 429 && data.retryAfterSeconds) {
          setResendCooldown(data.retryAfterSeconds);
        }
        setResetError(data.error || "Failed to request verification code");
        return;
      }

      setResendCooldown(60); // 60s rate limit countdown
      setTestModeActive(Boolean(data.testMode));
      setSimulatedCode(data.testOtpCode || null);
      setResetStep("verify");
    } catch (err: any) {
      setResetError(err.message || "Network error requesting OTP");
    } finally {
      setResetLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !resetEmail || resetLoading) return;
    setResetLoading(true);
    setResetError(null);

    try {
      const res = await fetch("/api/auth/forgot-password/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 429 && data.retryAfterSeconds) {
          setResendCooldown(data.retryAfterSeconds);
        }
        setResetError(data.error || "Failed to resend verification code");
        return;
      }

      setResendCooldown(60);
      setTestModeActive(Boolean(data.testMode));
      setSimulatedCode(data.testOtpCode || null);
      setOtpCode("");
    } catch (err: any) {
      setResetError(err.message || "Network error resending OTP");
    } finally {
      setResetLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) return;
    setResetLoading(true);
    setResetError(null);

    try {
      const res = await fetch("/api/auth/forgot-password/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail, otp: otpCode }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setResetError(data.error || "Invalid verification code");
        return;
      }

      setResetToken(data.resetToken);
      setResetStep("new_password");
    } catch (err: any) {
      setResetError(err.message || "Network error verifying OTP");
    } finally {
      setResetLoading(false);
    }
  };

  // Step 3: Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setResetError("Password must be at least 6 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match");
      return;
    }
    if (!resetToken) {
      setResetError("Verification session expired. Please request a new OTP.");
      return;
    }

    setResetLoading(true);
    setResetError(null);

    try {
      const res = await fetch("/api/auth/forgot-password/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetEmail,
          resetToken,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setResetError(data.error || "Failed to reset password");
        return;
      }

      setResetStep("success");
      setEmail(resetEmail);
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setResetError(err.message || "Network error setting new password");
    } finally {
      setResetLoading(false);
    }
  };

  const formatLockTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div
      id="auth-screen-container"
      className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4 sm:p-6 text-stone-900 font-sans"
    >
      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-6">
        <img
          src="/logo.png"
          alt="St. Mark Music & Instruments"
          className="w-11 h-11 rounded-2xl object-cover shadow-md border border-amber-900/40"
        />
        <div>
          <h2 className="text-xl font-bold tracking-tight text-stone-900">
            St. Mark Music & Instruments
          </h2>
          <p className="text-xs text-stone-600 font-medium">
            Reserve instruments for church use
          </p>
        </div>
      </div>

      <div
        id="auth-card"
        className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-xl shadow-stone-300/40 p-6 sm:p-8"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/80 mb-3 shadow-xs">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            {mode === "login" ? "Sign In" : "Create an Account"}
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            {mode === "login"
              ? "Access church instrument schedules with your email and password"
              : "Register with your email and contact information to request instruments"}
          </p>
        </div>

        {/* Tab Selector */}
        <div
          id="auth-mode-tabs"
          className="grid grid-cols-2 p-1 bg-stone-100 rounded-xl mb-6 text-xs font-semibold"
        >
          <button
            id="tab-btn-login"
            type="button"
            onClick={() => {
              clearError();
              setMode("login");
            }}
            className={`py-2 text-center rounded-lg transition-all cursor-pointer ${
              mode === "login"
                ? "bg-white text-stone-900 shadow-xs font-bold"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            Sign In
          </button>
          <button
            id="tab-btn-register"
            type="button"
            onClick={() => {
              clearError();
              setRegistrationNotice(null);
              setMode("register");
            }}
            className={`py-2 text-center rounded-lg transition-all cursor-pointer ${
              mode === "register"
                ? "bg-white text-stone-900 shadow-xs font-bold"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            New Registration
          </button>
        </div>

        {/* Registration Submitted & Awaiting Approval Notice */}
        {registrationNotice && !error && !isLocked && (
          <div
            id="auth-pending-notice-banner"
            className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-3"
          >
            <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-amber-900 text-sm">
                Registration Submitted
              </div>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                {registrationNotice}
              </p>
            </div>
          </div>
        )}

        {/* Lockout Warning Banner */}
        {isLocked && (
          <div
            id="auth-lockout-banner"
            className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-3 animate-pulse"
          >
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-red-900 text-sm">
                Account Temporarily Locked
              </div>
              <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
                5 consecutive failed login attempts detected. For security,
                logins for this account are locked for 15 minutes.
              </p>
              <div className="flex items-center gap-2 font-mono text-sm font-bold text-red-900 mt-2 bg-red-100 px-3 py-1.5 rounded-lg w-fit border border-red-200">
                <Clock className="w-4 h-4 text-red-700" />
                <span>
                  Lockout expires in: {formatLockTime(lockRemainingSeconds)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Failed Attempt / Error Banner */}
        {error && !isLocked && (
          <div
            id="auth-error-banner"
            className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5"
          >
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed font-medium">{error}</div>
          </div>
        )}

        {/* Auth Form */}
        <form id="auth-form" onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label
                htmlFor="register-name-input"
                className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5"
              >
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="register-name-input"
                  type="text"
                  required
                  placeholder="e.g. Samuel Mark"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-700 transition"
                />
              </div>
            </div>
          )}

          {/* Email Address Field (Unique Identifier) */}
          <div>
            <label
              htmlFor="auth-email-input"
              className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5"
            >
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="auth-email-input"
                type="email"
                required
                placeholder="e.g. membername@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-700 transition"
              />
            </div>
            {mode === "register" && (
              <p className="text-[11px] text-stone-400 mt-1.5">
                You'll receive emails for reservation approvals at this
                address.{" "}
              </p>
            )}
          </div>

          {/* Phone Number Field (Required for Registration) */}
          {mode === "register" && (
            <div>
              <label
                htmlFor="register-phone-input"
                className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5"
              >
                Phone Number <span className="normal-case">(WhatsApp)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  id="register-phone-input"
                  type="tel"
                  required
                  placeholder="e.g. 01012345678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-700 transition"
                />
              </div>
            </div>
          )}

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="auth-password-input"
                className="block text-xs font-bold uppercase tracking-wider text-stone-600"
              >
                Password
              </label>
              {mode === "login" && (
                <button
                  id="btn-forgot-password"
                  type="button"
                  onClick={openForgotPassword}
                  className="text-xs text-amber-800 hover:text-amber-900 font-semibold hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="auth-password-input"
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-700 transition"
              />
              <button
                type="button"
                id="btn-toggle-auth-password"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-700 transition cursor-pointer focus:outline-none"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {mode === "register" && (
              <p className="text-[11px] text-stone-400 mt-1.5">
                Minimum 6 characters.
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            id="auth-submit-btn"
            type="submit"
            disabled={submitting || isLocked}
            className="w-full mt-3 py-2.5 px-4 bg-amber-800 hover:bg-amber-900 active:bg-amber-950 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>
                  {mode === "login" ? "Sign In" : "Complete Registration"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security Policy Footer */}
        <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-center gap-2 text-stone-500 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Automatic 15-minute lock after 5 failed attempts</span>
        </div>
      </div>

      {/* Interactive Email OTP Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div
          id="forgot-password-modal-backdrop"
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            id="forgot-password-modal"
            className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-150"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    Reset Account Password
                  </h3>
                  <p className="text-xs text-stone-500">
                    Verify your email to continue
                  </p>
                </div>
              </div>
              <button
                id="btn-close-forgot-modal"
                onClick={() => setShowForgotPasswordModal(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Banner */}
            {resetError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">{resetError}</div>
              </div>
            )}

            {/* STEP 1: Request OTP by Email */}
            {resetStep === "request" && (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <p className="text-xs text-stone-600 leading-relaxed">
                  Enter your registered account email. A 6-digit one-time
                  verification code (OTP) will be dispatched to your inbox.
                </p>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="reset-email-input"
                      type="email"
                      required
                      placeholder="e.g. membername@gmail.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-700 transition"
                    />
                  </div>
                </div>

                <button
                  id="btn-request-otp"
                  type="submit"
                  disabled={resetLoading || !resetEmail}
                  className="w-full py-2.5 bg-amber-800 hover:bg-amber-900 active:bg-amber-950 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  {resetLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Send 6-Digit Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: Verify OTP */}
            {resetStep === "verify" && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                {/* TEST MODE BANNER */}
                {testModeActive && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex flex-col gap-2">
                    <div className="flex items-center gap-2 font-bold text-amber-900">
                      <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded text-[10px] uppercase tracking-wider font-extrabold">
                        TEST/DEV MODE
                      </span>
                      <span>Simulated Email OTP</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-normal">
                      RESEND_API_KEY is not set or in test mode. The generated
                      verification code for{" "}
                      <strong className="font-semibold">{resetEmail}</strong>{" "}
                      is:
                    </p>
                    <div className="flex items-center justify-center bg-white border border-amber-300 px-3 py-1.5 rounded-lg">
                      <span className="font-mono text-base font-bold tracking-widest text-amber-950">
                        {simulatedCode || "123456"}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
                      6-Digit Code
                    </label>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resetLoading || resendCooldown > 0}
                      className="text-xs text-amber-800 hover:underline flex items-center gap-1 cursor-pointer font-medium disabled:opacity-50 disabled:no-underline"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${resetLoading ? "animate-spin" : ""}`}
                      />
                      <span>
                        {resendCooldown > 0
                          ? `Resend (${resendCooldown}s)`
                          : "Resend Code"}
                      </span>
                    </button>
                  </div>
                  <input
                    id="reset-otp-input"
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) =>
                      setOtpCode(e.target.value.replace(/\D/g, ""))
                    }
                    className="w-full text-center font-mono text-xl tracking-widest py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-700 transition"
                  />
                  <p className="text-[11px] text-stone-500 mt-1 text-center">
                    Code expires in 10 minutes (max 3 verification attempts)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResetStep("request")}
                    className="py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs rounded-xl transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    id="btn-verify-otp"
                    type="submit"
                    disabled={resetLoading || otpCode.length < 6}
                    className="py-2.5 bg-amber-800 hover:bg-amber-900 active:bg-amber-950 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {resetLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Verify Code</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Set New Password */}
            {resetStep === "new_password" && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-xs text-stone-600 leading-relaxed">
                  Verification successful. Choose a new secure password for your
                  account (minimum 6 characters).
                </p>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="reset-new-password-input"
                      type={showNewPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-700 transition"
                    />
                    <button
                      type="button"
                      id="btn-toggle-reset-new-password"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-700 transition cursor-pointer focus:outline-none"
                      tabIndex={-1}
                      aria-label={
                        showNewPassword ? "Hide password" : "Show password"
                      }
                      aria-describedby="password-visibility-hint"
                      title={
                        showNewPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="reset-confirm-password-input"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-700 transition"
                    />
                    <button
                      type="button"
                      id="btn-toggle-reset-confirm-password"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-700 transition cursor-pointer focus:outline-none"
                      tabIndex={-1}
                      aria-label={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                      title={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  id="btn-save-new-password"
                  type="submit"
                  disabled={
                    resetLoading ||
                    newPassword.length < 6 ||
                    newPassword !== confirmPassword
                  }
                  className="w-full py-2.5 bg-amber-800 hover:bg-amber-900 active:bg-amber-950 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  {resetLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Save New Password</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 4: Success */}
            {resetStep === "success" && (
              <div className="text-center py-2">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-stone-900 mb-1">
                  Password Reset Complete
                </h4>
                <p className="text-xs text-stone-600 mb-5 leading-relaxed">
                  Your password has been securely updated. You can now sign in
                  immediately.
                </p>
                <button
                  id="btn-done-reset"
                  onClick={() => {
                    setShowForgotPasswordModal(false);
                    setMode("login");
                  }}
                  className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Proceed to Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
