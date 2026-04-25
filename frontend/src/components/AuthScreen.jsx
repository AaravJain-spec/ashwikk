import { useState } from "react";
import { motion } from "framer-motion";
import { api, setToken } from "@/lib/api";

const ErrorMsg = ({ msg }) =>
  msg ? (
    <div
      data-testid="auth-error"
      className="font-mono text-[11px] tracking-wider text-[#ff9500]"
    >
      ! {msg}
    </div>
  ) : null;

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
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
    <div className="relative min-h-screen w-full bg-black text-white flex items-stretch grain">
      {/* Left: brand panel */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="hidden md:flex relative w-1/2 flex-col justify-between p-12 overflow-hidden topo-bg border-r border-[#141414]"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full bg-[#00f0ff]"
              style={{ boxShadow: "0 0 18px #00f0ff" }}
            />
            <span className="eyebrow">studyos · context-os v1</span>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="font-display text-5xl lg:text-6xl leading-[0.95] tracking-tighter">
            a study OS
            <br />
            that <span className="glow-cyan text-[#00f0ff]">breathes</span>
            <br />
            with you.
          </h1>
          <p className="mt-6 text-zinc-400 max-w-md leading-relaxed">
            One fluid canvas. No tabs, no menus. The interface morphs to your
            cognitive state — calm cyan when you flow, warm amber when you
            struggle, silent when you focus.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
            {[
              ["zen frame", "single focal point"],
              ["context map", "topography of you"],
              ["sidekick", "socratic, never loud"],
            ].map(([k, v]) => (
              <div key={k} className="border-l border-[#27272a] pl-3">
                <div className="eyebrow">{k}</div>
                <div className="text-sm text-zinc-300 mt-1">{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 eyebrow">
          ·· built for long-horizon reasoning · 2026
        </div>

        {/* ambient glow blob */}
        <div
          className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(0,240,255,0.18) 0%, transparent 60%)",
            filter: "blur(40px)",
          }}
        />
      </motion.div>

      {/* Right: auth form */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="flex-1 flex items-center justify-center p-8"
      >
        <form
          onSubmit={submit}
          data-testid="auth-form"
          className="w-full max-w-sm space-y-6"
        >
          <div className="space-y-2">
            <div className="eyebrow">
              {mode === "login" ? "·· return to canvas" : "·· initialize mind"}
            </div>
            <h2 className="font-display text-3xl tracking-tight">
              {mode === "login" ? "sign in" : "create account"}
            </h2>
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

          <ErrorMsg msg={err} />

          <button
            type="submit"
            disabled={busy}
            data-testid="auth-submit-btn"
            className="group relative w-full h-12 rounded-full bg-[#00f0ff] text-black font-medium tracking-tight transition-all hover:bg-white disabled:opacity-50"
            style={{ boxShadow: "0 0 40px -8px rgba(0,240,255,0.6)" }}
          >
            <span className="relative z-10">
              {busy ? "..." : mode === "login" ? "enter" : "begin"}
            </span>
          </button>

          <button
            type="button"
            data-testid="auth-toggle-btn"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setErr("");
            }}
            className="w-full text-xs text-zinc-500 font-mono tracking-wider hover:text-[#00f0ff] transition-colors"
          >
            {mode === "login"
              ? "// no account? create one"
              : "// already have one? sign in"}
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
        className="w-full bg-transparent border-b border-[#27272a] py-2 text-base text-white placeholder-zinc-700 focus:border-[#00f0ff] transition-colors"
      />
    </label>
  );
}
