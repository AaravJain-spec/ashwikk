import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * 2D topographical "map of your brain".
 * - High mastery ⇒ bright high "peak" (cyan)
 * - Low mastery  ⇒ deep shadowed "valley" (dark)
 * - Glowing "Next Path" line connects the user through the lowest valleys.
 */
export default function ContextMap({ topics, onPickTopic, user, onLogout }) {
  const [hovered, setHovered] = useState(null);

  // sort by mastery asc → "next path" walks from weakest to next-weakest etc.
  const path = useMemo(() => {
    const sorted = [...topics].sort((a, b) => a.mastery - b.mastery);
    return sorted.slice(0, 5);
  }, [topics]);

  const pathD = useMemo(() => {
    if (path.length < 2) return "";
    const pts = path.map((t) => [t.x * 1000, t.y * 600]);
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const cx = (x0 + x1) / 2;
      d += ` Q ${cx} ${y0 - 40}, ${x1} ${y1}`;
    }
    return d;
  }, [path]);

  const weakest = path[0];

  return (
    <motion.div
      key="map"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="relative w-full h-screen overflow-hidden bg-black text-white grain"
      data-testid="context-map"
    >
      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full bg-[#00f0ff]"
            style={{ boxShadow: "0 0 18px #00f0ff" }}
          />
          <span className="eyebrow">studyos · context map</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:block text-right">
            <div className="eyebrow">operator</div>
            <div className="font-mono text-sm text-zinc-300">
              {user?.name?.toLowerCase() || "anon"}
            </div>
          </div>
          <button
            onClick={onLogout}
            data-testid="logout-btn"
            className="font-mono text-[11px] tracking-wider text-zinc-500 hover:text-[#ff9500] transition-colors"
          >
            // sign out
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="absolute inset-0 topo-bg" />

      {/* SVG terrain */}
      <svg
        viewBox="0 0 1000 600"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full z-10"
      >
        <defs>
          <radialGradient id="peakGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.85" />
            <stop offset="40%" stopColor="#00f0ff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="valleyShade" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* contour grid (subtle) */}
        {Array.from({ length: 9 }).map((_, i) => (
          <ellipse
            key={i}
            cx="500"
            cy="300"
            rx={120 + i * 60}
            ry={70 + i * 36}
            fill="none"
            stroke="#101013"
            strokeWidth="1"
          />
        ))}

        {/* valleys (low mastery → dark wells) */}
        {topics.map((t) => {
          if (t.mastery > 50) return null;
          const r = 80 + (50 - t.mastery) * 1.6;
          return (
            <circle
              key={`v-${t.id}`}
              cx={t.x * 1000}
              cy={t.y * 600}
              r={r}
              fill="url(#valleyShade)"
            />
          );
        })}

        {/* peaks (high mastery → bright glows) */}
        {topics.map((t) => {
          if (t.mastery <= 50) return null;
          const r = 70 + (t.mastery - 50) * 1.8;
          return (
            <circle
              key={`p-${t.id}`}
              cx={t.x * 1000}
              cy={t.y * 600}
              r={r}
              fill="url(#peakGlow)"
            />
          );
        })}

        {/* Next Path */}
        {pathD && (
          <>
            <path
              d={pathD}
              fill="none"
              stroke="#00f0ff"
              strokeOpacity="0.18"
              strokeWidth="14"
              filter="url(#softGlow)"
            />
            <path
              d={pathD}
              fill="none"
              stroke="#00f0ff"
              strokeWidth="2"
              className="path-flow"
              strokeLinecap="round"
            />
          </>
        )}

        {/* Topic nodes */}
        {topics.map((t) => {
          const cx = t.x * 1000;
          const cy = t.y * 600;
          const isWeak = weakest && t.id === weakest.id;
          const ring = 14 + t.mastery * 0.18;
          return (
            <g
              key={t.id}
              onMouseEnter={() => setHovered(t)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onPickTopic(t)}
              style={{ cursor: "pointer" }}
              data-testid={`topic-node-${t.id}`}
            >
              <circle
                cx={cx}
                cy={cy}
                r={ring + 8}
                fill="none"
                stroke={isWeak ? "#00f0ff" : "rgba(255,255,255,0.08)"}
                strokeWidth={isWeak ? "1.5" : "1"}
              />
              <circle
                cx={cx}
                cy={cy}
                r={ring}
                fill={t.mastery > 50 ? "#00f0ff" : "#0a0a0a"}
                fillOpacity={t.mastery > 50 ? 0.18 : 1}
                stroke={t.mastery > 50 ? "#00f0ff" : "#27272a"}
                strokeWidth="1"
              />
              <circle
                cx={cx}
                cy={cy}
                r="3"
                fill={t.mastery > 50 ? "#00f0ff" : "#52525b"}
              />
              <text
                x={cx}
                y={cy + ring + 18}
                textAnchor="middle"
                className="font-mono"
                fontSize="11"
                fill={isWeak ? "#00f0ff" : "#a1a1aa"}
                style={{ letterSpacing: "0.05em" }}
              >
                {t.name.toLowerCase()}
              </text>
              <text
                x={cx}
                y={cy + ring + 32}
                textAnchor="middle"
                className="font-mono"
                fontSize="9"
                fill="#52525b"
              >
                {t.mastery}%
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover detail card */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30 glass rounded-2xl px-6 py-4 min-w-[280px]"
            data-testid="topic-hover-card"
          >
            <div className="eyebrow">{hovered.domain}</div>
            <div className="font-display text-2xl mt-1">
              {hovered.name.toLowerCase()}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="font-mono text-xs text-zinc-500">mastery</div>
              <div className="flex-1 h-[2px] bg-[#141414] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00f0ff]"
                  style={{
                    width: `${hovered.mastery}%`,
                    boxShadow: "0 0 12px #00f0ff",
                  }}
                />
              </div>
              <div className="font-mono text-xs text-[#00f0ff]">
                {hovered.mastery}%
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom CTA */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-8 pb-10">
        <div className="flex items-end justify-between gap-8">
          <div className="max-w-md">
            <div className="eyebrow mb-2">·· next action engine</div>
            <h2 className="font-display text-3xl tracking-tighter">
              walk the valley:{" "}
              <span className="glow-cyan text-[#00f0ff]">
                {weakest?.name.toLowerCase() || "—"}
              </span>
            </h2>
            <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
              the path snakes through your weakest topics first. each session
              raises a peak.
            </p>
          </div>
          <motion.button
            data-testid="start-session-btn"
            onClick={() => weakest && onPickTopic(weakest)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group relative h-14 px-8 rounded-full bg-[#00f0ff] text-black font-medium tracking-tight"
            style={{ boxShadow: "0 0 50px -8px rgba(0,240,255,0.7)" }}
          >
            <span className="relative z-10">start session →</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
