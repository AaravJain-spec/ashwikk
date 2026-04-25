import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, Sparkles } from "lucide-react";
import { pickNextAction, priorityReason } from "@/lib/priorityEngine";

/**
 * Hero Screen — single-action dominance.
 *   "YOUR NEXT MOVE" → big task card → reason → START SESSION.
 * No tabs, no menus, no charts. The agent has decided. You execute.
 */
export default function HeroScreen({
  user,
  topics,
  sessions,
  onStart,
  onLogout,
  onChangeSyllabus,
  onOpenInsights,
  onOpenSidekick,
  cognitiveLoad,
  isStruggling,
}) {
  const nextAction = useMemo(() => pickNextAction(topics), [topics]);

  // duration suggestion based on mastery gap
  const suggestedMinutes = useMemo(() => {
    if (!nextAction) return 25;
    const gap = (100 - (nextAction.mastery ?? 0)) / 100;
    if (gap > 0.7) return 25;
    if (gap > 0.4) return 20;
    return 15;
  }, [nextAction]);

  const todayCount = sessions.filter((s) => {
    return new Date(s.started_at).toDateString() === new Date().toDateString();
  }).length;

  return (
    <motion.div
      key="hero"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full min-h-screen overflow-y-auto paper text-[#2b211a] flex flex-col"
      data-testid="hero-screen"
    >
      {/* masthead */}
      <header className="relative z-10 max-w-[1180px] w-full mx-auto px-10 lg:px-16 pt-8 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-baseline gap-3">
            <span className="font-serif italic text-2xl text-[#a35c44]">
              studyos
            </span>
            <span className="rule-gold w-12" />
            <span className="eyebrow">·· ai study agent</span>
          </div>
          {user?.syllabus_name && (
            <button
              onClick={onChangeSyllabus}
              data-testid="syllabus-chip"
              title="change syllabus"
              className="flex items-center gap-2 px-4 h-9 rounded-full border border-[#e5ded0] hover:border-[#a35c44] bg-[#fffaf2] text-xs font-sans text-[#5b4f44] hover:text-[#a35c44] transition-colors"
            >
              <span className="font-instrument-serif italic text-[#c5a059]">·</span>
              <span className="tracking-wide">
                {user.syllabus_name}
                {user.class_level && (
                  <>
                    {" "}
                    <span className="text-[#9b8e7e]">·</span> class{" "}
                    {user.class_level}
                  </>
                )}
              </span>
              <span className="text-[10px] text-[#9b8e7e] tracking-widest uppercase">
                change
              </span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-7">
          <button
            onClick={onOpenInsights}
            data-testid="open-insights-btn"
            className="flex items-center gap-2 text-sm text-[#5b4f44] hover:text-[#a35c44] font-sans transition-colors"
          >
            <BarChart3 size={14} /> insights
          </button>
          <button
            onClick={onOpenSidekick}
            data-testid="open-sidekick-btn"
            className="text-sm text-[#5b4f44] hover:text-[#a35c44] font-sans transition-colors"
          >
            sidekick
          </button>
          <button
            onClick={onLogout}
            data-testid="logout-btn"
            className="text-xs text-[#9b8e7e] hover:text-[#a35c44] font-sans tracking-wider transition-colors"
          >
            sign out
          </button>
        </div>
      </header>

      {/* HERO */}
      <main className="relative z-10 flex-1 flex items-center">
        <div className="max-w-[1180px] w-full mx-auto px-10 lg:px-16 py-16 grid grid-cols-12 gap-8">
          {/* left: prompt */}
          <div className="col-span-12 lg:col-span-5">
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.05 }}
            >
              <div className="eyebrow flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: isStruggling ? "#a35c44" : "#c5a059",
                    boxShadow: `0 0 12px ${isStruggling ? "#a35c44" : "#c5a059"}`,
                  }}
                />
                ·· the agent has decided
              </div>
              <h1
                className="mt-5 font-serif text-[68px] lg:text-[100px] leading-[0.92] text-[#2b211a]"
                style={{ letterSpacing: "-0.025em" }}
              >
                Your next
                <br />
                <span className="italic text-[#a35c44]">move</span>.
              </h1>
              <p className="mt-7 font-instrument-serif italic text-lg text-[#5b4f44] max-w-md leading-relaxed">
                {user?.name ? `${user.name}, ` : ""}
                {isStruggling
                  ? "the room is breathing. start with one easier rep."
                  : "no menus. no choices. one focal point. begin when ready."}
              </p>
              <div className="mt-10 flex items-center gap-6 eyebrow">
                <span>
                  today · <span className="text-[#a35c44]">{todayCount}</span>
                </span>
                <span className="text-[#e5ded0]">|</span>
                <span>
                  load · <span className="text-[#a35c44]">{Math.round((cognitiveLoad ?? 0) * 100)}%</span>
                </span>
                <span className="text-[#e5ded0]">|</span>
                <span>
                  topics · <span className="text-[#a35c44]">{topics.length}</span>
                </span>
              </div>
            </motion.div>
          </div>

          {/* right: huge task card */}
          <div className="col-span-12 lg:col-span-7">
            <motion.div
              layoutId="task-card"
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="linen-card p-10 lg:p-12 relative overflow-hidden"
              data-testid="next-move-card"
            >
              <div className="flex items-center justify-between">
                <span className="eyebrow">·· next action</span>
                <Sparkles size={16} className="text-[#c5a059]" />
              </div>

              <div className="mt-7">
                <div className="font-instrument-serif italic text-base text-[#9b8e7e]">
                  do
                </div>
                <h2
                  className="mt-1 font-serif text-5xl lg:text-6xl text-[#2b211a]"
                  style={{ letterSpacing: "-0.02em" }}
                  data-testid="next-move-title"
                >
                  5 {nextAction?.name?.toLowerCase() || "—"}
                  <span className="italic text-[#a35c44]"> questions</span>
                </h2>
                <div className="mt-3 font-instrument-serif italic text-2xl text-[#a35c44]">
                  {suggestedMinutes} mins
                </div>
              </div>

              <div className="rule-gold my-9" />

              <div>
                <div className="eyebrow">·· why this</div>
                <p
                  className="mt-2 font-instrument-serif italic text-lg text-[#2b211a] leading-relaxed max-w-xl"
                  data-testid="next-move-reason"
                >
                  {nextAction
                    ? buildReason(nextAction)
                    : "your first session — pick this and begin."}
                </p>
              </div>

              <motion.button
                onClick={() => nextAction && onStart(nextAction, suggestedMinutes)}
                whileHover={{ scale: 1.005 }}
                whileTap={{ scale: 0.98 }}
                disabled={!nextAction}
                data-testid="start-session-btn"
                className="wax-seal mt-10 w-full h-20 rounded-2xl text-2xl flex items-center justify-center gap-4 disabled:opacity-50"
              >
                <span>Start Session</span>
                <ArrowRight size={22} strokeWidth={2.2} />
              </motion.button>

              <div className="mt-4 flex items-center justify-between font-sans text-[10px] tracking-[0.2em] uppercase text-[#9b8e7e]">
                <span>priority {(nextAction?.priority ?? 0).toFixed(2)}</span>
                <span>mastery {nextAction?.mastery ?? 0}%</span>
                <span>{nextAction?.domain || "—"}</span>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 max-w-[1180px] w-full mx-auto px-10 lg:px-16 pb-8 flex items-center justify-between eyebrow">
        <span>·· studyos · ai study agent · 2026</span>
        <span>—</span>
        <span>do · not · decide</span>
      </footer>
    </motion.div>
  );
}

function buildReason(t) {
  const m = t.mastery ?? 0;
  const reasons = [];
  if (!t.last_touched_at) reasons.push("you haven't touched this yet");
  else reasons.push("memory is decaying since you last opened it");
  if (m < 30) reasons.push("mastery is the lowest on your map");
  else if (m < 60) reasons.push("there's a real gap to close");
  return reasons.join(" · ") + ".";
}
