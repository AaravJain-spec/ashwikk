import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  Compass,
  Flame,
  Sparkles,
} from "lucide-react";
import { pickNextAction, priorityReason, rankTopics } from "@/lib/priorityEngine";

/**
 * The Bento Dashboard — high whitespace, editorial, warm.
 * Tiles:
 *   1. Daily Intent (hero, centered serif welcome)
 *   2. Next Action (large wax-seal button, the priority engine's pick)
 *   3. Mastery Topography (watercolor SVG)
 *   4. Today / Rhythm (small, mono numbers)
 *   5. Reading Room (recent sessions)
 *   6. Stack (all topics list, terse)
 */
export default function BentoDashboard({
  user,
  topics,
  sessions,
  onPickTopic,
  onLogout,
  onOpenSidekick,
  onChangeSyllabus,
  cognitiveLoad,
  isStruggling,
}) {
  const nextAction = useMemo(() => pickNextAction(topics), [topics]);
  const ranked = useMemo(() => rankTopics(topics).slice(0, 8), [topics]);
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "Late hours,";
    if (h < 12) return "Good morning,";
    if (h < 18) return "Good afternoon,";
    return "Good evening,";
  }, []);

  const todayCount = sessions.filter((s) => {
    const t = new Date(s.started_at).toDateString();
    return t === new Date().toDateString();
  }).length;

  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full h-screen overflow-y-auto paper text-[#2b211a]"
      data-testid="bento-dashboard"
    >
      {/* Top masthead */}
      <div className="relative z-10 max-w-[1320px] mx-auto px-10 lg:px-16 pt-10 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-baseline gap-3">
            <span className="font-serif italic text-2xl text-[#a35c44]">
              studyos
            </span>
            <span className="rule-gold w-16" />
            <span className="eyebrow">·· vol. i · context</span>
          </div>
          {user?.syllabus_name && (
            <button
              onClick={onChangeSyllabus}
              data-testid="syllabus-chip"
              title="change syllabus"
              className="flex items-center gap-2 px-4 h-9 rounded-full border border-[#e5ded0] hover:border-[#a35c44] bg-[#fffaf2] text-xs font-sans text-[#5b4f44] hover:text-[#a35c44] transition-colors"
            >
              <span className="font-instrument-serif italic text-[#c5a059]">
                ·
              </span>
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
        <div className="flex items-center gap-8">
          <div className="hidden md:block text-right">
            <div className="eyebrow">reader</div>
            <div className="font-serif italic text-base text-[#2b211a]">
              {user?.name || "Anonymous"}
            </div>
          </div>
          <button
            onClick={onOpenSidekick}
            data-testid="open-sidekick-btn"
            className="text-sm text-[#5b4f44] hover:text-[#a35c44] font-sans tracking-wide transition-colors"
          >
            socratic sidekick
          </button>
          <button
            onClick={onLogout}
            data-testid="logout-btn"
            className="text-xs text-[#9b8e7e] hover:text-[#a35c44] font-sans tracking-wider transition-colors"
          >
            sign out
          </button>
        </div>
      </div>

      {/* Bento grid */}
      <div className="relative z-10 max-w-[1320px] mx-auto px-10 lg:px-16 py-12 grid grid-cols-12 gap-6 lg:gap-8 auto-rows-[minmax(120px,auto)]">
        {/* Daily Intent — hero, centered serif welcome */}
        <motion.section
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="col-span-12 lg:col-span-8 linen-card p-12 lg:p-16 relative overflow-hidden"
          data-testid="daily-intent-card"
        >
          <div className="absolute top-6 left-8 eyebrow">·· daily intent</div>
          <div className="absolute top-6 right-8 font-serif italic text-[#c5a059] text-sm">
            no. {String(todayCount + 1).padStart(2, "0")}
          </div>
          <div className="text-center max-w-2xl mx-auto pt-6">
            <p
              className="font-serif text-sm italic text-[#9b8e7e] mb-4"
              data-testid="greeting-text"
            >
              {greeting}
            </p>
            <h1
              className="font-serif text-5xl lg:text-7xl leading-[0.98] text-[#2b211a]"
              style={{ letterSpacing: "-0.02em" }}
            >
              {user?.name?.split(" ")[0] || "Friend"}
              <span className="text-[#a35c44]">.</span>
            </h1>
            <p className="mt-6 font-instrument-serif italic text-xl text-[#5b4f44] leading-relaxed">
              {isStruggling
                ? "Slow the pace. The mind wants air, not more pages."
                : "One quiet hour. One clear topic. Begin."}
            </p>
          </div>
        </motion.section>

        {/* Next Action — wax seal */}
        <motion.section
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.12 }}
          className="col-span-12 lg:col-span-4 linen-card p-8 flex flex-col justify-between min-h-[360px] relative"
          data-testid="next-action-card"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="eyebrow">·· next action</span>
              <Compass size={14} className="text-[#c5a059]" />
            </div>
            <div className="mt-6">
              <div className="font-serif italic text-sm text-[#9b8e7e]">
                most-pressing topic
              </div>
              <h3
                className="mt-2 font-serif text-3xl lg:text-4xl text-[#2b211a]"
                style={{ letterSpacing: "-0.015em" }}
                data-testid="next-action-title"
              >
                {nextAction?.name || "—"}
              </h3>
              <p className="mt-3 text-xs text-[#9b8e7e] font-sans italic leading-relaxed">
                {priorityReason(nextAction)}
              </p>
            </div>
          </div>

          <div className="space-y-3 mt-6">
            <div className="rule-gold" />
            <button
              onClick={() => nextAction && onPickTopic(nextAction)}
              disabled={!nextAction}
              data-testid="next-action-btn"
              className="wax-seal w-full h-16 rounded-full flex items-center justify-center gap-3 text-base"
            >
              <span>Begin session</span>
              <ArrowUpRight size={18} strokeWidth={2.2} />
            </button>
            <div className="flex items-center justify-between font-sans text-[10px] tracking-[0.18em] uppercase text-[#9b8e7e]">
              <span>priority {(nextAction?.priority ?? 0).toFixed(2)}</span>
              <span>mastery {nextAction?.mastery ?? 0}%</span>
            </div>
          </div>
        </motion.section>

        {/* Mastery Topography — watercolor */}
        <motion.section
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.18 }}
          className="col-span-12 lg:col-span-7 linen-card p-8 lg:p-10 relative overflow-hidden min-h-[360px]"
          data-testid="topography-card"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="eyebrow">·· mastery topography</span>
            <span className="font-instrument-serif italic text-[#c5a059] text-sm">
              fig. 1
            </span>
          </div>
          <h3
            className="font-serif text-2xl text-[#2b211a]"
            style={{ letterSpacing: "-0.01em" }}
          >
            The shape of <span className="italic text-[#a35c44]">your</span>{" "}
            knowing.
          </h3>

          <Watercolor topics={topics} onPick={onPickTopic} />
          <div className="mt-3 flex items-center justify-between font-sans text-[10px] tracking-[0.18em] uppercase text-[#9b8e7e]">
            <span>strong ↗ saturated · faint ↙ pale</span>
            <span>{topics.length} topics</span>
          </div>
        </motion.section>

        {/* Rhythm */}
        <motion.section
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.22 }}
          className="col-span-6 lg:col-span-3 linen-card p-7 flex flex-col justify-between min-h-[170px]"
          data-testid="rhythm-card"
        >
          <div className="flex items-center justify-between">
            <span className="eyebrow">·· today</span>
            <Flame size={14} className="text-[#a35c44]" />
          </div>
          <div>
            <div
              className="font-serif text-6xl text-[#2b211a]"
              data-testid="today-sessions-count"
            >
              {todayCount}
              <span className="font-instrument-serif italic text-2xl text-[#c5a059]">
                {" "}
                session{todayCount === 1 ? "" : "s"}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#9b8e7e] font-sans italic">
              {todayCount === 0
                ? "the page is still blank"
                : "the rhythm is set"}
            </p>
          </div>
        </motion.section>

        {/* Cognitive load gauge */}
        <motion.section
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.26 }}
          className="col-span-6 lg:col-span-2 linen-card p-7 flex flex-col justify-between min-h-[170px]"
          data-testid="cogload-card"
        >
          <div className="flex items-center justify-between">
            <span className="eyebrow">·· state</span>
            <Sparkles size={14} className="text-[#c5a059]" />
          </div>
          <div>
            <div
              className="font-serif text-3xl text-[#2b211a]"
              data-testid="cogload-value"
            >
              {(cognitiveLoad * 100).toFixed(0)}
              <span className="font-instrument-serif italic text-base text-[#c5a059]">
                %
              </span>
            </div>
            <p className="mt-1 text-xs text-[#9b8e7e] font-sans italic">
              {isStruggling ? "the room is breathing" : "calm cognition"}
            </p>
            <div className="mt-3 h-[2px] bg-[#ebe4d6] rounded-full overflow-hidden">
              <motion.div
                className="h-full"
                style={{
                  background: isStruggling ? "#a35c44" : "#c5a059",
                }}
                animate={{ width: `${cognitiveLoad * 100}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
          </div>
        </motion.section>

        {/* Reading Room — recent sessions */}
        <motion.section
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="col-span-12 lg:col-span-5 linen-card p-8 lg:p-10"
          data-testid="reading-room-card"
        >
          <div className="flex items-center justify-between mb-5">
            <span className="eyebrow">·· reading room</span>
            <BookOpen size={14} className="text-[#c5a059]" />
          </div>
          <h3
            className="font-serif text-2xl text-[#2b211a] mb-5"
            style={{ letterSpacing: "-0.01em" }}
          >
            Recent <span className="italic text-[#a35c44]">passages</span>
          </h3>
          {sessions.length === 0 ? (
            <p className="font-instrument-serif italic text-[#9b8e7e]">
              No sessions yet — your first page awaits.
            </p>
          ) : (
            <ul className="divide-y divide-[#e5ded0]">
              {sessions.slice(0, 5).map((s) => (
                <li
                  key={s.id}
                  className="py-3 flex items-baseline justify-between gap-4"
                >
                  <div className="font-serif text-base text-[#2b211a] truncate">
                    {s.topic_name}
                  </div>
                  <div className="font-sans text-[10px] tracking-[0.16em] uppercase text-[#9b8e7e] whitespace-nowrap">
                    {fmtDate(s.started_at)} ·{" "}
                    {s.mastery_delta > 0 ? `+${s.mastery_delta}` : s.mastery_delta || "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        {/* Stack — all topics terse */}
        <motion.section
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.34 }}
          className="col-span-12 lg:col-span-7 linen-card p-8 lg:p-10"
          data-testid="stack-card"
        >
          <div className="flex items-center justify-between mb-5">
            <span className="eyebrow">·· the stack</span>
            <span className="font-instrument-serif italic text-[#c5a059] text-sm">
              by priority
            </span>
          </div>
          <h3
            className="font-serif text-2xl text-[#2b211a] mb-5"
            style={{ letterSpacing: "-0.01em" }}
          >
            What to <span className="italic text-[#a35c44]">return to</span>.
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {ranked.map((t, i) => (
              <li
                key={t.id}
                className="border-b border-[#e5ded0] py-3 flex items-baseline justify-between gap-3 group cursor-pointer"
                onClick={() => onPickTopic(t)}
                data-testid={`stack-item-${t.id}`}
              >
                <div className="flex items-baseline gap-3 min-w-0">
                  <span className="font-instrument-serif italic text-[#c5a059] text-sm w-6">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-serif text-base text-[#2b211a] truncate group-hover:text-[#a35c44] transition-colors">
                    {t.name}
                  </span>
                </div>
                <span className="font-sans text-[10px] tracking-[0.16em] uppercase text-[#9b8e7e] whitespace-nowrap">
                  {t.mastery}% · {t.domain.split(" ")[0].toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </motion.section>
      </div>

      <div className="relative z-10 max-w-[1320px] mx-auto px-10 lg:px-16 pb-10 flex items-center justify-between eyebrow">
        <span>·· studyos · context-os edition no. 001</span>
        <span>—</span>
        <span>quietly · 2026</span>
      </div>
    </motion.div>
  );
}

/* ──────────────── Mastery Topography watercolor ──────────────── */
function Watercolor({ topics, onPick }) {
  // sort to layer the strongest blobs on top
  const sorted = [...topics].sort((a, b) => a.mastery - b.mastery);
  // group topics by domain to draw subject labels
  const domains = Array.from(new Set(sorted.map((t) => t.domain)));
  const showLabels = sorted.length <= 14;
  return (
    <div className="relative mt-5 h-[230px] w-full" data-testid="topography-svg">
      <svg
        viewBox="0 0 800 230"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full watercolor"
      >
        <defs>
          {sorted.map((t) => (
            <radialGradient
              key={`g-${t.id}`}
              id={`wc-${t.id}`}
              cx="50%"
              cy="50%"
              r="50%"
            >
              <stop
                offset="0%"
                stopColor={t.mastery > 50 ? "#a35c44" : "#c5a059"}
                stopOpacity={0.16 + (t.mastery / 100) * 0.36}
              />
              <stop
                offset="60%"
                stopColor={t.mastery > 50 ? "#a35c44" : "#c5a059"}
                stopOpacity={0.04 + (t.mastery / 100) * 0.06}
              />
              <stop offset="100%" stopColor="#fdfbf7" stopOpacity="0" />
            </radialGradient>
          ))}
          <filter id="wcBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* watercolor blobs — placed at backend-provided x/y for subject bands */}
        {sorted.map((t) => {
          const cx = (t.x ?? 0.5) * 800;
          const cy = (t.y ?? 0.5) * 200 + 10;
          const r = 38 + (t.mastery / 100) * 60;
          return (
            <g key={t.id} filter="url(#wcBlur)">
              <ellipse
                cx={cx}
                cy={cy}
                rx={r}
                ry={r * 0.7}
                fill={`url(#wc-${t.id})`}
              />
            </g>
          );
        })}

        {/* dotted ground rule */}
        <line
          x1="20"
          x2="780"
          y1="218"
          y2="218"
          stroke="#e5ded0"
          strokeDasharray="2 6"
        />

        {/* subject domain labels along the bottom */}
        {domains.map((d, i) => {
          const x = 20 + ((i + 0.5) / domains.length) * 760;
          return (
            <text
              key={d}
              x={x}
              y={228}
              textAnchor="middle"
              fontFamily="Instrument Sans, sans-serif"
              fontSize="9"
              letterSpacing="0.18em"
              fill="#9b8e7e"
            >
              {d.toUpperCase()}
            </text>
          );
        })}

        {/* topic labels — only when sparse enough to read */}
        {showLabels &&
          sorted.map((t) => {
            const cx = (t.x ?? 0.5) * 800;
            const cy = (t.y ?? 0.5) * 200 + 10;
            return (
              <g
                key={`lbl-${t.id}`}
                onClick={() => onPick(t)}
                style={{ cursor: "pointer" }}
                data-testid={`topo-label-${t.id}`}
              >
                <text
                  x={cx}
                  y={cy + 4}
                  textAnchor="middle"
                  fontFamily="Playfair Display, serif"
                  fontStyle="italic"
                  fontSize="10"
                  fill="#5b4f44"
                >
                  {t.name.toLowerCase()}
                </text>
              </g>
            );
          })}
      </svg>
    </div>
  );
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}
