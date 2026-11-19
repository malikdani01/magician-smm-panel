import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { authClient, authEnabled, rememberSessionToken, signIn } from "@/lib/auth/client";
import { Mark, inputClass } from "@/components/shell";
import { Starfield } from "@/components/stars";
import { applyMotion } from "@/lib/theme";
import { publicAuthGate } from "@/lib/admin.functions";
import mage from "@/assets/login-mage.jpg";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const [closed, setClosed] = useState(false);

  useEffect(() => {
    applyMotion();
    publicAuthGate().then((gate) => setClosed(!gate.open)).catch(() => setClosed(false));
    const params = new URLSearchParams(window.location.search);
    const code = params.get("error") || "";
    if (!code) return;
    const known: Record<string, string> = {
      state_mismatch: "Your Google session expired. Continue with Google again.",
      please_restart_the_process: "The Google return host did not match. Try again.",
      access_denied: "Google ne sign-in cancel kar diya.",
      account_not_linked: "This email already uses password login. Sign in with the password first.",
    };
    setError(known[code] || `Google sign-in stopped (${code}). Try again.`);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (closed && mode === "up") {
      setError("Login and registration are closed.");
      return;
    }
    setError("");
    setPending(true);
    try {
      if (mode === "up") {
        const result = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0] || "Member",
          callbackURL: "/dashboard",
        });
        if (result.error) throw new Error(result.error.message || "Could not create the account.");
        const token = (result.data as { token?: string } | null)?.token;
        if (token) rememberSessionToken(token);
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
          callbackURL: "/dashboard",
        });
        if (result.error) throw new Error(result.error.message || "Those details were not accepted.");
        const token = (result.data as { token?: string } | null)?.token;
        if (token) rememberSessionToken(token);
      }
      window.location.assign("/dashboard");
      return;
    } catch (err) {
      setError(plainLoginError(err instanceof Error ? err.message : "Sign-in failed."));
    } finally {
      setPending(false);
    }
  }

  async function continueWithGoogle() {
    setError("");
    setPending(true);
    try {
      if (typeof window !== "undefined" && window.location.hostname.endsWith(".grok-sandbox.com")) {
        await signIn("grok-google", { callbackURL: "/dashboard", errorCallbackURL: "/login" });
        return;
      }
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
        errorCallbackURL: "/login",
      });
      if (result?.error) {
        const message = result.error.message || "";
        throw new Error(/provider|not found|disabled/i.test(message)
          ? "Google login is not configured on the server yet."
          : message);
      }
    } catch (err) {
      setError(plainLoginError(err instanceof Error ? err.message : "Could not continue."));
      setPending(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8">
      <img src={mage} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#070312]/90 via-[#070312]/70 to-[#070312]/20" />
      <Starfield />
      <div className="relative z-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-white/80">
          <ArrowLeft className="size-4" /> Back to home
        </Link>
        <div className="page-motion mx-auto mt-8 w-full max-w-md">
          <div className="mb-6 flex justify-center"><Mark /></div>
          <div className="glass-card rounded-3xl border p-6 md:p-8">
            <h1 className="rise-in text-3xl text-white">{mode === "in" ? "Welcome back" : "Create your desk"}</h1>
            <p className="rise-in rise-d1 mt-1 text-sm text-white/70">
              {mode === "in" ? "Sign in to your dashboard." : "Free account. Add credit when you are ready."}
            </p>
            {closed && <p className="mt-3 rounded-xl bg-amber-500/15 px-3 py-2 text-[13px] text-amber-100">Customer login and registration are closed. Admin login still works.</p>}
            {authEnabled ? (
              <form onSubmit={submit} className="mt-6 space-y-4">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => continueWithGoogle()}
                  className="btn-live inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white text-sm font-semibold text-slate-900 disabled:opacity-50"
                >
                  <GoogleMark />
                  Continue with Google
                </button>
                <p className="text-center text-[11px] uppercase tracking-[0.18em] text-white/50">or use email</p>
                {mode === "up" && (
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-white/70">Name</span>
                    <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                  </label>
                )}
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-white/70">Email</span>
                  <input className={inputClass} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
                </label>
                <label className="block space-y-1.5">
                  <span className="flex items-center justify-between text-xs font-semibold text-white/70">
                    Password
                    {mode === "in" && <span className="font-medium text-amber-300">8+ characters</span>}
                  </span>
                  <input className={inputClass} type="password" required minLength={8} autoComplete={mode === "up" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                </label>
                {error && <p className="text-sm font-semibold text-red-500">{error}</p>}
                <button type="submit" disabled={pending} className="btn-live inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-amber-300 text-sm font-semibold text-slate-950 disabled:opacity-50">
                  {pending ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
                </button>
                <button type="button" className="w-full text-center text-sm text-white/70" onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(""); }}>
                  {mode === "in" ? <>Don't have an account? <span className="font-semibold text-amber-300">Sign up</span></> : <>Already have a desk? <span className="font-semibold text-amber-300">Sign in</span></>}
                </button>
                {(error === "You are blocked" || error === "You are suspended") && (
                  <button
                    type="button"
                    onClick={() => {
                      sessionStorage.setItem("appeal-email", email.trim().toLowerCase());
                      window.location.assign("/appeal");
                    }}
                    className="h-10 w-full rounded-xl border border-amber-300/40 text-sm font-semibold text-amber-300"
                  >
                    Support chat
                  </button>
                )}
              </form>
            ) : (
              <p className="mt-4 text-sm text-white/70">Sign-in is disabled.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function plainLoginError(message: string) {
  const text = message.toLowerCase();
  if (text.includes("blocked")) return "You are blocked";
  if (text.includes("suspended")) return "You are suspended";
  return message;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden>
      <path fill="#EA4335" d="M9 7.2v3.4h4.7c-.2 1.1-.8 2-1.7 2.6l2.7 2.1c1.6-1.5 2.5-3.6 2.5-6.1 0-.6 0-1.1-.1-1.6H9z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.4-.8 5.9-2.2l-2.7-2.1c-.8.5-1.8.9-3.2.9-2.4 0-4.5-1.6-5.2-3.9L1 13c1.5 3 4.5 5 8 5z" />
      <path fill="#4A90E2" d="M3.8 10.7A5.4 5.4 0 0 1 3.5 9c0-.6.1-1.2.3-1.7L1 5C.4 6.2 0 7.6 0 9s.4 2.8 1 4l2.8-2.3z" />
      <path fill="#FBBC05" d="M9 3.6c1.3 0 2.5.4 3.4 1.3L14.8 2.4C13.2.9 11.2 0 9 0 5.5 0 2.5 2 1 5l2.8 2.3C4.5 5.2 6.6 3.6 9 3.6z" />
    </svg>
  );
}
