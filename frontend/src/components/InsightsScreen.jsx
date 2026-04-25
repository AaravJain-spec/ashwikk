import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingDown } from "lucide-react";
import { api } from "@/lib/api";

/**
 * Insights — minimal but powerful.
 *   Weak topics · Behavior patterns · Predicted marks loss.
 */
export default function InsightsScreen({ onBack }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api
      .get("/insights")
      .then(({ data }) => setData(data))
      .catch((e) => setErr(e?.response?.data?.detail || "could not load insights"));
  }, []);

  return (
    <motion.div
      key="insights"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="relative w-full min-h-screen overflow-y-auto paper text-[#2b211a]"
      data-testid="insights-screen"
    >
      <header className="relative z-10 max-w-[1180px] w-full mx-auto px-10 lg:px-16 pt-10 flex items-center justify-between">
        <button
          onClick={onBack}
          data-testid="insights-back-btn"
          className="flex items-center gap-2 text-sm text-[#5b4f44] hover:text-[#a35c44] font-sans transition-colors"
        >
          <ArrowLeft size={14} /> back
        </button>
        <div className="flex items-baseline gap-3">
          <span className="font-serif italic text-2xl text-[#a35c44]">
            studyos
          </span>
          <span className="rule-gold w-12" />
          <span className="eyebrow">·· insights</span>
        </div>
        <div className="eyebrow">vol. ii</div>
      </header>

      <main className="relative z-10 max-w-[1180px] w-full mx-auto px-10 lg:px-16 py-12 lg:py-16">
        <div className="eyebrow">·· what the agent sees</div>
        <h1
          className="mt-3 font-serif text-5xl lg:text-7xl text-[#2b211a] leading-[0.96]"
          style={{ letterSpacing: "-0.02em" }}
        >
          What you{" "}
          <span className="italic text-[#a35c44]">don't</span>{" "}
          know yet.
        </h1>
        <p className="mt-4 font-instrument-serif italic text-lg text-[#5b4f44] max-w-2xl">
          A short, honest read of your patterns. Where mastery is thin, what
          you do under pressure, and what it might cost on the day of.
        </p>

        {err && (
          <p
            data-testid="insights-error"
            className="mt-6 font-sans text-[12px] text-[#a35c44] italic"
          >
            ! {err}
          </p>
        )}

        {data && (
          <div className="grid grid-cols-12 gap-6 lg:gap-8 mt-12">
            {/* Weak topics */}
            <section className="col-span-12 lg:col-span-7 linen-card p-8 lg:p-10" data-testid="weak-topics-card">
              <div className="flex items-center justify-between mb-1">
                <span className="eyebrow">·· weak topics</span>
                <span className="font-instrument-serif italic text-[#c5a059] text-sm">
                  fig. 1
                </span>
              </div>
              <h3
                className="font-serif text-2xl text-[#2b211a]"
                style={{ letterSpacing: "-0.01em" }}
              >
                Where the <span className="italic text-[#a35c44]">soil is thin</span>.
              </h3>
              {data.weak_topics?.length ? (
                <ul className="mt-6 divide-y divide-[#e5ded0]">
                  {data.weak_topics.map((t, i) => (
                    <li
                      key={t.id}
                      className="py-4 flex items-baseline justify-between gap-4"
                      data-testid={`weak-topic-${i}`}
                    >
                      <div className="flex items-baseline gap-3 min-w-0">
                        <span className="font-instrument-serif italic text-[#c5a059] w-8">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="font-serif text-lg text-[#2b211a] truncate">
                          {t.name}
                        </span>
                        <span className="font-sans text-[10px] tracking-[0.18em] uppercase text-[#9b8e7e]">
                          {t.domain}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="w-32 h-[2px] bg-[#ebe4d6] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#a35c44]"
                            style={{ width: `${t.mastery}%` }}
                          />
                        </div>
                        <span className="font-instrument-serif italic text-base text-[#a35c44] w-12 text-right">
                          {t.mastery}%
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-6 font-instrument-serif italic text-[#9b8e7e]">
                  Mastery is even — nothing screaming for attention yet.
                </p>
              )}
            </section>

            {/* Patterns */}
            <section className="col-span-12 lg:col-span-5 linen-card p-8 lg:p-10" data-testid="patterns-card">
              <div className="flex items-center justify-between mb-1">
                <span className="eyebrow">·· behavior patterns</span>
                <span className="font-instrument-serif italic text-[#c5a059] text-sm">
                  fig. 2
                </span>
              </div>
              <h3
                className="font-serif text-2xl text-[#2b211a]"
                style={{ letterSpacing: "-0.01em" }}
              >
                What you do under{" "}
                <span className="italic text-[#a35c44]">pressure</span>.
              </h3>
              {data.patterns?.length ? (
                <ul className="mt-6 space-y-5">
                  {data.patterns.map((p, i) => (
                    <li key={i} data-testid={`pattern-${i}`}>
                      <div className="font-serif text-lg text-[#2b211a]">
                        {p.label}
                      </div>
                      <div className="mt-1 font-instrument-serif italic text-sm text-[#9b8e7e]">
                        — {p.detail}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-6 font-instrument-serif italic text-[#9b8e7e]">
                  Not enough sessions yet. The patterns will surface after a
                  few full sessions.
                </p>
              )}
            </section>

            {/* Predictions */}
            <section className="col-span-12 linen-card p-8 lg:p-10" data-testid="predictions-card">
              <div className="flex items-center justify-between mb-1">
                <span className="eyebrow flex items-center gap-2">
                  <TrendingDown size={12} className="text-[#a35c44]" /> ·· predicted marks loss
                </span>
                <span className="font-instrument-serif italic text-[#c5a059] text-sm">
                  fig. 3 · rule-based estimate
                </span>
              </div>
              <h3
                className="font-serif text-2xl text-[#2b211a]"
                style={{ letterSpacing: "-0.01em" }}
              >
                What this could{" "}
                <span className="italic text-[#a35c44]">cost</span> on exam day.
              </h3>
              {data.predictions?.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                  {data.predictions.map((p, i) => (
                    <div
                      key={i}
                      data-testid={`prediction-${i}`}
                      className="p-5 rounded-2xl border border-[#e5ded0] bg-[#fffaf2]"
                    >
                      <div className="font-instrument-serif italic text-[10px] tracking-[0.18em] uppercase text-[#9b8e7e]">
                        {p.domain}
                      </div>
                      <div className="font-serif text-xl text-[#2b211a] mt-1">
                        {p.topic}
                      </div>
                      <div className="rule-gold my-3" />
                      <div className="flex items-baseline gap-2">
                        <span className="font-serif text-3xl text-[#a35c44]">
                          {p.marks_loss_min}–{p.marks_loss_max}
                        </span>
                        <span className="font-instrument-serif italic text-sm text-[#9b8e7e]">
                          marks at risk
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-6 font-instrument-serif italic text-[#9b8e7e]">
                  Mastery looks healthy. Keep the rhythm.
                </p>
              )}
            </section>

            {/* Totals strip */}
            {data.totals && (
              <section className="col-span-12 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Total label="topics" value={data.totals.topics} />
                <Total label="sessions" value={data.totals.sessions} />
                <Total label="questions" value={data.totals.questions} />
                <Total
                  label="overall accuracy"
                  value={
                    data.totals.overall_accuracy != null
                      ? `${data.totals.overall_accuracy}%`
                      : "—"
                  }
                />
              </section>
            )}
          </div>
        )}
      </main>

      <footer className="relative z-10 max-w-[1180px] w-full mx-auto px-10 lg:px-16 pb-10 flex items-center justify-between eyebrow">
        <span>·· estimates only · trust the trend, not the number</span>
        <span>—</span>
        <span>quietly · 2026</span>
      </footer>
    </motion.div>
  );
}

function Total({ label, value }) {
  return (
    <div className="linen-card p-5">
      <div className="eyebrow">{label}</div>
      <div className="font-serif text-3xl text-[#2b211a] mt-1">{value}</div>
    </div>
  );
}
