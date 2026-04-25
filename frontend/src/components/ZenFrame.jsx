import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import SocraticSidekick from "@/components/SocraticSidekick";

/**
 * Zen Execution Frame — single focal point.
 * Breathing pulse: cyan → amber when struggle_score > 60.
 */
const QUICK_REFS = {
  // demo: pretend these terms are difficult and show pop cards
  eigenvalue:
    "a scalar λ such that Av = λv for some non-zero vector v. it tells you a direction the linear map only stretches.",
  manifold:
    "a space that locally looks like flat ℝⁿ. zoom in enough and curvature disappears.",
  entropy:
    "in info theory, the average surprise. high entropy ⇒ outcomes are unpredictable.",
  eigenvector:
    "a non-zero vector v whose direction is preserved by a linear map A: Av = λv.",
};

export default function ZenFrame({ topic, user, onExit }) {
  const [session, setSession] = useState(null);
  const [duration, setDuration] = useState(25); // minutes
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [struggle, setStruggle] = useState(0);
  const [hoverTerm, setHoverTerm] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [ghostNudge, setGhostNudge] = useState(null);
  const tickRef = useRef(null);

  // Start session once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.post("/sessions/start", {
          topic_id: topic.id,
          duration_minutes: duration,
        });
        if (!cancelled) setSession(data);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic.id]);

  // Timer
  useEffect(() => {
    if (!running) return undefined;
    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [running]);

  // Ghost nudges (simulated thought-nudges from the local UI; richer ones via chat)
  useEffect(() => {
    if (!running) return undefined;
    const seeds = [
      "··try restating it in your own words first.",
      "··what's the smallest example you can construct?",
      "··spot a symmetry — does that simplify anything?",
      "··if struggle climbs, ask the sidekick for a single nudge.",
    ];
    let i = 0;
    setGhostNudge(seeds[0]);
    const id = setInterval(() => {
      i = (i + 1) % seeds.length;
      setGhostNudge(seeds[i]);
    }, 9000);
    return () => clearInterval(id);
  }, [running]);

  // Push struggle to backend (debounced)
  useEffect(() => {
    if (!session) return undefined;
    const id = setTimeout(() => {
      api
        .post(`/sessions/${session.id}/struggle`, { struggle_score: struggle })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(id);
  }, [struggle, session]);

  const isStruggling = struggle > 60;

  function fmt(s) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  async function endNow(success) {
    try {
      if (session) {
        await api.post(`/sessions/${session.id}/end`, {
          mastery_delta: success ? 5 : -1,
        });
      }
    } catch (e) {
      // noop
    }
    onExit();
  }

  // Re-set total when duration changes pre-start
  useEffect(() => {
    if (!running) setSecondsLeft(duration * 60);
  }, [duration, running]);

  const total = duration * 60;
  const progress = total > 0 ? 1 - secondsLeft / total : 0;

  // Render task text with hoverable difficult terms
  const taskText = `today: probe ${topic.name.toLowerCase()}. start with the most basic eigenvalue you can write down. construct one tiny example, then ask: which manifold does this live on, and what entropy does the result have?`;
  const renderTask = () => {
    const parts = taskText.split(/(eigenvalue|manifold|entropy|eigenvector)/g);
    return parts.map((p, i) => {
      const ref = QUICK_REFS[p.toLowerCase()];
      if (ref) {
        return (
          <span
            key={i}
            onMouseEnter={() => setHoverTerm({ term: p, ref })}
            onMouseLeave={() => setHoverTerm(null)}
            data-testid={`hover-term-${p}`}
            className="relative cursor-help text-[#00f0ff] underline decoration-dotted underline-offset-4 decoration-[#00f0ff]/40 hover:decoration-[#00f0ff] transition-colors"
          >
            {p}
          </span>
        );
      }
      return <span key={i}>{p}</span>;
    });
  };

  return (
    <motion.div
      key="zen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="relative w-full h-screen overflow-hidden bg-black text-white grain"
      data-testid="zen-frame"
    >
      {/* HUD top */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 py-6">
        <button
          onClick={() => endNow(false)}
          data-testid="exit-zen-btn"
          className="font-mono text-[11px] tracking-wider text-zinc-500 hover:text-[#00f0ff] transition-colors"
        >
          ← exit canvas
        </button>
        <div className="flex items-center gap-3">
          <div
            className={`w-2 h-2 rounded-full ${
              isStruggling ? "bg-[#ff9500]" : "bg-[#00f0ff]"
            }`}
            style={{
              boxShadow: `0 0 18px ${isStruggling ? "#ff9500" : "#00f0ff"}`,
            }}
          />
          <span className="eyebrow">
            {isStruggling ? "·· cognitive load high" : "·· in flow"}
          </span>
        </div>
        <div className="font-mono text-[11px] tracking-wider text-zinc-500">
          {topic.domain.toLowerCase()}
        </div>
      </div>

      {/* Ghost-text nudges in left margin */}
      <AnimatePresence mode="wait">
        {running && ghostNudge && (
          <motion.div
            key={ghostNudge}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute top-1/2 left-6 -translate-y-1/2 z-10 max-w-[200px] hidden lg:block"
            data-testid="ghost-nudge"
          >
            <div className="eyebrow mb-2 opacity-50">socratic ··</div>
            <div className="font-mono text-xs text-zinc-600 leading-relaxed">
              {ghostNudge}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center frame */}
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <motion.div
          layout
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className={`relative w-full max-w-3xl glass rounded-[28px] p-10 md:p-14 ${
            isStruggling ? "pulse-amber" : "pulse-cyan"
          }`}
          data-testid="zen-card"
        >
          {/* corner ticks */}
          <CornerTicks color={isStruggling ? "#ff9500" : "#00f0ff"} />

          <div className="eyebrow">·· session · {topic.domain.toLowerCase()}</div>
          <h1 className="mt-4 font-display text-4xl md:text-5xl leading-[1.05] tracking-tighter">
            {topic.name.toLowerCase()}
          </h1>

          <p className="mt-8 text-lg text-zinc-300 leading-relaxed">
            {renderTask()}
          </p>

          {/* HUD: timer + mastery */}
          <div className="mt-10 grid grid-cols-2 gap-6">
            <div>
              <div className="eyebrow">time remaining</div>
              <div
                className="font-mono text-4xl md:text-5xl mt-2 tracking-tight"
                data-testid="timer-display"
                style={{
                  color: isStruggling ? "#ff9500" : "#fff",
                }}
              >
                {fmt(secondsLeft)}
              </div>
              <div className="mt-3 h-[2px] bg-[#141414] rounded-full overflow-hidden">
                <motion.div
                  className="h-full"
                  style={{
                    background: isStruggling ? "#ff9500" : "#00f0ff",
                    boxShadow: `0 0 10px ${isStruggling ? "#ff9500" : "#00f0ff"}`,
                  }}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
            <div>
              <div className="eyebrow">mastery</div>
              <div className="font-mono text-4xl md:text-5xl mt-2 tracking-tight">
                {topic.mastery}%
              </div>
              <div className="mt-3 h-[2px] bg-[#141414] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00f0ff]"
                  style={{
                    width: `${topic.mastery}%`,
                    boxShadow: "0 0 10px #00f0ff",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Struggle slider (manual proxy for detection) */}
          {running && (
            <div className="mt-8">
              <div className="flex items-center justify-between">
                <div className="eyebrow">struggle score</div>
                <div
                  className="font-mono text-xs"
                  style={{ color: isStruggling ? "#ff9500" : "#52525b" }}
                  data-testid="struggle-score"
                >
                  {struggle}
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={struggle}
                onChange={(e) => setStruggle(Number(e.target.value))}
                data-testid="struggle-slider"
                className="w-full mt-2 accent-[#00f0ff]"
                style={{
                  accentColor: isStruggling ? "#ff9500" : "#00f0ff",
                }}
              />
              <div className="mt-1 font-mono text-[10px] text-zinc-600 tracking-wider">
                ·· cognitive load proxy · breath turns amber above 60
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="mt-10 flex items-center gap-4 flex-wrap">
            {!running ? (
              <>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  data-testid="duration-select"
                  className="bg-[#0a0a0a] border border-[#27272a] rounded-full px-4 h-12 font-mono text-sm text-zinc-300 focus:border-[#00f0ff]"
                >
                  {[10, 15, 25, 45, 60].map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setRunning(true)}
                  data-testid="begin-session-btn"
                  className="h-12 px-8 rounded-full bg-[#00f0ff] text-black font-medium tracking-tight"
                  style={{
                    boxShadow: "0 0 50px -8px rgba(0,240,255,0.7)",
                  }}
                >
                  begin
                </motion.button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setRunning(false)}
                  data-testid="pause-btn"
                  className="h-12 px-6 rounded-full border border-[#27272a] text-zinc-300 hover:border-[#00f0ff] hover:text-[#00f0ff] transition-colors"
                >
                  pause
                </button>
                <button
                  onClick={() => endNow(true)}
                  data-testid="finish-btn"
                  className="h-12 px-8 rounded-full bg-[#00f0ff] text-black font-medium"
                  style={{
                    boxShadow: "0 0 40px -8px rgba(0,240,255,0.6)",
                  }}
                >
                  finish · level up
                </button>
              </>
            )}
            <button
              onClick={() => setChatOpen(true)}
              data-testid="open-sidekick-btn"
              className="ml-auto h-12 px-5 rounded-full border border-[#27272a] text-zinc-400 hover:border-[#00f0ff] hover:text-[#00f0ff] font-mono text-xs tracking-wider transition-colors"
            >
              ·· socratic sidekick
            </button>
          </div>

          {/* Quick-Reference hover card */}
          <AnimatePresence>
            {hoverTerm && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className="absolute -top-4 left-1/2 -translate-x-1/2 -translate-y-full z-30 max-w-sm"
                data-testid="quick-ref-card"
              >
                <div className="glass rounded-2xl px-5 py-4">
                  <div className="eyebrow">quick-reference · {hoverTerm.term}</div>
                  <div className="mt-2 text-sm text-zinc-300 leading-relaxed">
                    {hoverTerm.ref}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Sidekick slide-in */}
      <AnimatePresence>
        {chatOpen && session && (
          <SocraticSidekick
            session={session}
            struggle={struggle}
            onClose={() => setChatOpen(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CornerTicks({ color }) {
  const t = (style) => (
    <div
      style={{
        position: "absolute",
        width: 14,
        height: 14,
        borderColor: color,
        opacity: 0.6,
        ...style,
      }}
    />
  );
  return (
    <>
      {t({ top: 12, left: 12, borderLeft: "1px solid", borderTop: "1px solid" })}
      {t({ top: 12, right: 12, borderRight: "1px solid", borderTop: "1px solid" })}
      {t({ bottom: 12, left: 12, borderLeft: "1px solid", borderBottom: "1px solid" })}
      {t({ bottom: 12, right: 12, borderRight: "1px solid", borderBottom: "1px solid" })}
    </>
  );
}
