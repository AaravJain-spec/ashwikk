import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Pause, Play, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";

const QUICK_REFS = {
  eigenvalue:
    "a scalar λ such that Av = λv for some non-zero vector v. it tells you a direction the linear map only stretches.",
  manifold:
    "a space that locally looks like flat ℝⁿ. zoom in enough and curvature disappears.",
  entropy:
    "in info theory, the average surprise. high entropy ⇒ outcomes are unpredictable.",
  eigenvector:
    "a non-zero vector v whose direction is preserved by a linear map A: Av = λv.",
};

export default function FlowFrame({
  topic,
  ctx,
  onExit,
  onOpenSidekick,
}) {
  const [session, setSession] = useState(null);
  const [duration, setDuration] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [hoverTerm, setHoverTerm] = useState(null);
  const [notes, setNotes] = useState("");
  const tickRef = useRef(null);

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

  useEffect(() => {
    if (!running) return undefined;
    tickRef.current = setInterval(
      () => setSecondsLeft((s) => Math.max(0, s - 1)),
      1000
    );
    return () => clearInterval(tickRef.current);
  }, [running]);

  useEffect(() => {
    if (!running) setSecondsLeft(duration * 60);
  }, [duration, running]);

  // push struggle to backend (debounced)
  useEffect(() => {
    if (!session) return undefined;
    const id = setTimeout(() => {
      const score = Math.round((ctx.cognitiveLoad ?? 0) * 100);
      api
        .post(`/sessions/${session.id}/struggle`, { struggle_score: score })
        .catch(() => {});
    }, 500);
    return () => clearTimeout(id);
  }, [ctx.cognitiveLoad, session]);

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
      // ignore
    }
    onExit();
  }

  const total = duration * 60;
  const progress = total > 0 ? 1 - secondsLeft / total : 0;

  const taskText = `Today: probe ${topic.name.toLowerCase()}. Begin with the most basic eigenvalue you can write down. Construct one tiny example, then ask: which manifold does this live on, and what entropy does the result have?`;

  const renderTask = () => {
    const parts = taskText.split(/(eigenvalue|manifold|entropy|eigenvector)/gi);
    return parts.map((p, i) => {
      const ref = QUICK_REFS[p.toLowerCase()];
      if (ref) {
        return (
          <span
            key={i}
            onMouseEnter={() => setHoverTerm({ term: p, ref })}
            onMouseLeave={() => setHoverTerm(null)}
            data-testid={`hover-term-${p.toLowerCase()}`}
            className="relative cursor-help text-[#a35c44] italic underline decoration-dotted underline-offset-[5px] decoration-[#a35c44]/40 hover:decoration-[#a35c44] transition-colors"
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
      key="flow"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full h-screen overflow-hidden paper text-[#2b211a]"
      data-testid="flow-frame"
    >
      {/* HUD top */}
      <div className="absolute top-0 left-0 right-0 z-20 px-10 lg:px-16 py-7 flex items-center justify-between">
        <button
          onClick={() => endNow(false)}
          data-testid="exit-flow-btn"
          className="flex items-center gap-2 text-sm text-[#5b4f44] hover:text-[#a35c44] font-sans transition-colors"
        >
          <ArrowLeft size={14} /> the room
        </button>
        <div className="flex items-center gap-3 eyebrow">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: ctx.isStruggling ? "#a35c44" : "#c5a059",
              boxShadow: `0 0 14px ${ctx.isStruggling ? "#a35c44" : "#c5a059"}`,
            }}
          />
          <span>{ctx.isStruggling ? "·· room is breathing" : "·· in flow"}</span>
        </div>
        <button
          onClick={onOpenSidekick}
          data-testid="open-sidekick-btn-flow"
          className="text-sm text-[#5b4f44] hover:text-[#a35c44] font-sans transition-colors"
        >
          socratic sidekick
        </button>
      </div>

      {/* Center — premium sheet of paper */}
      <div className="absolute inset-0 flex items-center justify-center px-6 py-20">
        <motion.div
          layout
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className={`sheet w-full max-w-3xl p-12 md:p-16 ${
            ctx.isStruggling ? "breathe-warm" : "breathe-sienna"
          }`}
          data-testid="flow-sheet"
        >
          {/* masthead inside the sheet */}
          <div className="flex items-baseline justify-between mb-8">
            <div className="eyebrow">·· session</div>
            <div className="font-instrument-serif italic text-[#c5a059] text-sm">
              {topic.domain.toLowerCase()}
            </div>
          </div>

          <h1
            className="font-serif text-4xl md:text-5xl text-[#2b211a] leading-[1.05]"
            style={{ letterSpacing: "-0.02em" }}
          >
            <span className="italic">{topic.name.toLowerCase()}</span>
            <span className="text-[#a35c44]">.</span>
          </h1>

          <div className="rule-gold my-7" />

          <p className="text-lg text-[#2b211a] leading-[1.65] font-instrument-serif">
            {renderTask()}
          </p>

          {/* HUD: timer + mastery */}
          <div className="mt-10 grid grid-cols-2 gap-8">
            <div>
              <div className="eyebrow">time remaining</div>
              <div
                className="font-serif text-5xl md:text-6xl mt-2 tracking-tight"
                data-testid="timer-display"
                style={{ color: ctx.isStruggling ? "#a35c44" : "#2b211a" }}
              >
                {fmt(secondsLeft)}
              </div>
              <div className="mt-3 h-[2px] bg-[#ebe4d6] rounded-full overflow-hidden">
                <motion.div
                  className="h-full"
                  style={{
                    background: ctx.isStruggling ? "#a35c44" : "#c5a059",
                  }}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
            <div>
              <div className="eyebrow">mastery</div>
              <div className="font-serif text-5xl md:text-6xl mt-2 tracking-tight">
                {topic.mastery}
                <span className="font-instrument-serif italic text-2xl text-[#c5a059]">
                  %
                </span>
              </div>
              <div className="mt-3 h-[2px] bg-[#ebe4d6] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#a35c44]"
                  style={{ width: `${topic.mastery}%` }}
                />
              </div>
            </div>
          </div>

          {/* notes — handwritten feeling */}
          {running && (
            <div className="mt-8">
              <div className="eyebrow mb-2">·· notes</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="write your way through it…"
                data-testid="flow-notes"
                rows={4}
                className="w-full bg-transparent border-b border-[#e5ded0] focus:border-[#a35c44] resize-none font-instrument-serif italic text-base text-[#2b211a] placeholder-[#c8bdab] py-2 leading-relaxed transition-colors"
              />
              <div className="font-sans text-[10px] tracking-[0.18em] uppercase text-[#9b8e7e] mt-1">
                idle {ctx.idleTime?.toFixed(0) ?? 0}s · v{" "}
                {(ctx.inputVelocity ?? 0).toFixed(1)} cps · replays{" "}
                {ctx.videoReplayCount ?? 0}
              </div>
            </div>
          )}

          {/* controls */}
          <div className="mt-10 flex items-center gap-3 flex-wrap">
            {!running ? (
              <>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  data-testid="duration-select"
                  className="bg-transparent border border-[#e5ded0] rounded-full px-5 h-12 font-sans text-sm text-[#2b211a] focus:border-[#a35c44] transition-colors"
                >
                  {[10, 15, 25, 45, 60].map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setRunning(true)}
                  data-testid="begin-session-btn"
                  className="wax-seal h-12 px-7 rounded-full text-base flex items-center gap-2"
                >
                  <Play size={16} fill="currentColor" /> Begin
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setRunning(false)}
                  data-testid="pause-btn"
                  className="h-12 px-5 rounded-full border border-[#e5ded0] text-[#5b4f44] hover:border-[#a35c44] hover:text-[#a35c44] font-sans text-sm transition-colors flex items-center gap-2"
                >
                  <Pause size={14} /> Pause
                </button>
                <button
                  onClick={() => endNow(true)}
                  data-testid="finish-btn"
                  className="wax-seal h-12 px-7 rounded-full text-base flex items-center gap-2"
                >
                  Finish · level up
                </button>
                <button
                  onClick={ctx.recordReplay}
                  data-testid="replay-btn"
                  title="record a re-watch / re-read"
                  className="h-12 px-4 rounded-full border border-[#e5ded0] text-[#5b4f44] hover:border-[#c5a059] hover:text-[#a35c44] font-sans text-xs transition-colors flex items-center gap-2"
                >
                  <RotateCcw size={14} /> replay
                </button>
              </>
            )}
          </div>

          {/* dev: cognitive-load override (so the breathing/struggle is visible) */}
          {running && (
            <div className="mt-8 p-4 rounded-2xl border border-dashed border-[#e5ded0] bg-[#faf6ee]">
              <div className="flex items-center justify-between">
                <span className="eyebrow">·· cognitive load</span>
                <span
                  className="font-instrument-serif italic text-sm"
                  style={{
                    color: ctx.isStruggling ? "#a35c44" : "#9b8e7e",
                  }}
                  data-testid="cogload-readout"
                >
                  {(ctx.cognitiveLoad * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(ctx.cognitiveLoad * 100)}
                onChange={(e) =>
                  ctx.setLoadOverride(Number(e.target.value) / 100)
                }
                data-testid="cogload-slider"
                className="w-full mt-2"
                style={{ accentColor: "#a35c44" }}
              />
              <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-[#9b8e7e] mt-1">
                · auto-derived from idle · velocity · replays · slide to feel it
              </p>
            </div>
          )}

          {/* Quick-reference popover */}
          <AnimatePresence>
            {hoverTerm && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.25 }}
                className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full z-30 max-w-md"
                data-testid="quick-ref-card"
              >
                <div className="linen-card p-5">
                  <div className="eyebrow">·· quick-reference · {hoverTerm.term.toLowerCase()}</div>
                  <p className="mt-2 font-instrument-serif italic text-base text-[#2b211a] leading-relaxed">
                    {hoverTerm.ref}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}
