import { useState } from "react";
import { motion } from "framer-motion";
import { api, setToken } from "@/lib/api";

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const url = mode === "login" ? "/auth/login" : "/auth/signup";
      const body =
        mode === "login" ? { email, password } : { email, password, name };
      const { data } = await api.post(url, body);
      setToken(data.token);
      onAuthed(data.user);
    } catch (e) {
      setErr(e?.response?.data?.detail || "something went sideways");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full paper text-[#2b211a] flex items-stretch">
      {/* Left: editorial brand panel */}
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="hidden md:flex relative w-[55%] flex-col justify-between p-14 lg:p-20 border-r border-[#e5ded0] z-10"
      >
        <div className="flex items-baseline gap-3">
          <span className="font-serif italic text-2xl text-[#a35c44]">
            studyos
          </span>
          <span className="rule-gold flex-1 max-w-[80px]" />
          <span className="eyebrow">vol. i · context</span>
        </div>

        <div className="max-w-2xl">
          <p className="eyebrow mb-6">·· an adaptive learning os</p>
          <h1
            className="font-serif text-[64px] lg:text-[88px] leading-[0.95] text-[#2b211a]"
            style={{ letterSpacing: "-0.02em" }}
          >
            <span className="italic font-normal">study</span>,
            <br />
            <span className="text-[#a35c44]">unhurried</span>.
          </h1>
          <p className="mt-8 text-lg text-[#5b4f44] leading-relaxed max-w-md font-sans">
            Quiet luxury for the mind. One serif sheet, one wax-sealed action,
            one warm room that breathes with you when the work gets dense.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-6 max-w-lg">
            {[
              ["i.", "daily intent"],
              ["ii.", "next action"],
              ["iii.", "flow frame"],
            ].map(([n, v]) => (
              <div key={n} className="border-l border-[#e5ded0] pl-4">
                <div className="font-serif italic text-[#c5a059] text-xl">
                  {n}
                </div>
                <div className="mt-1 text-sm text-[#2b211a] font-sans">
                  {v}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between eyebrow">
          <span>·· est. 2026</span>
          <span>edition no. 001</span>
        </div>
      </motion.div>

      {/* Right: form */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15 }}
        className="flex-1 flex items-center justify-center p-10 z-10"
      >
        <form
          onSubmit={submit}
          data-testid="auth-form"
          className="w-full max-w-md space-y-7"
        >
          <div className="space-y-3">
            <div className="eyebrow">
              {mode === "login" ? "·· return" : "·· begin"}
            </div>
            <h2 className="font-serif text-5xl tracking-tight text-[#2b211a]">
              {mode === "login" ? (
                <>
                  Welcome <span className="italic text-[#a35c44]">back</span>.
                </>
              ) : (
                <>
                  Make your <span className="italic text-[#a35c44]">mark</span>.
                </>
              )}
            </h2>
            <p className="text-sm text-[#9b8e7e] font-sans">
              {mode === "login"
                ? "Sign in to your study room."
                : "A quiet account, just for you."}
            </p>
          </div>

          {mode === "signup" && (
            <Field
              label="name"
              value={name}
              onChange={setName}
              testid="auth-name-input"
              required
            />
          )}
          <Field
            label="email"
            type="email"
            value={email}
            onChange={setEmail}
            testid="auth-email-input"
            required
          />
          <Field
            label="password"
            type="password"
            value={password}
            onChange={setPassword}
            testid="auth-password-input"
            required
          />

          {err && (
            <div
              data-testid="auth-error"
              className="font-sans text-[12px] text-[#a35c44] italic"
            >
              ! {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            data-testid="auth-submit-btn"
            className="wax-seal w-full h-14 rounded-full text-base disabled:opacity-60"
          >
            {busy ? "..." : mode === "login" ? "Enter" : "Begin"}
          </button>

          <button
            type="button"
            data-testid="auth-toggle-btn"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setErr("");
            }}
            className="w-full text-xs text-[#9b8e7e] font-sans hover:text-[#a35c44] transition-colors tracking-wide"
          >
            {mode === "login"
              ? "— no account? request one —"
              : "— already a reader? sign in —"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, testid }) {
  return (
    <label className="block">
      <div className="eyebrow mb-2">{label}</div>
      <input
        data-testid={testid}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent border-b border-[#e5ded0] py-2 text-base text-[#2b211a] placeholder-[#c8bdab] focus:border-[#a35c44] transition-colors font-sans"
      />
    </label>
  );
}
