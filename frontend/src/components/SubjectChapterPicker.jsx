import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { rankTopics } from "@/lib/priorityEngine";

/**
 * Subject → Chapter picker.
 * Two steps:
 *   1. Pick a subject (domain) from the user's syllabus
 *   2. Pick a chapter (topic) within that subject
 * Then start a session on the picked topic.
 */
export default function SubjectChapterPicker({
  topics,
  user,
  onCancel,
  onPick,
}) {
  const [step, setStep] = useState("subject"); // "subject" | "chapter"
  const [subject, setSubject] = useState(null);
  const [duration, setDuration] = useState(25);

  // group topics by domain (subject)
  const subjects = useMemo(() => {
    const map = new Map();
    for (const t of topics) {
      const key = t.domain || "Untitled";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    // sort subjects alphabetically; chapters by priority desc
    const arr = [];
    for (const [name, items] of map.entries()) {
      const ranked = rankTopics(items);
      const avgMastery = Math.round(
        items.reduce((s, t) => s + (t.mastery || 0), 0) / Math.max(1, items.length)
      );
      arr.push({ name, items: ranked, count: items.length, avgMastery });
    }
    arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }, [topics]);

  const activeSubject = useMemo(
    () => subjects.find((s) => s.name === subject),
    [subjects, subject]
  );

  return (
    <motion.div
      key="picker"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="relative w-full min-h-screen overflow-y-auto paper text-[#2b211a]"
      data-testid="picker-screen"
    >
      <header className="relative z-10 max-w-[1180px] w-full mx-auto px-10 lg:px-16 pt-10 flex items-center justify-between">
        <button
          onClick={() => (step === "chapter" ? setStep("subject") : onCancel())}
          data-testid="picker-back-btn"
          className="flex items-center gap-2 text-sm text-[#5b4f44] hover:text-[#a35c44] font-sans transition-colors"
        >
          <ArrowLeft size={14} /> {step === "chapter" ? "subjects" : "back"}
        </button>
        <div className="flex items-baseline gap-3">
          <span className="font-serif italic text-2xl text-[#a35c44]">
            studyos
          </span>
          <span className="rule-gold w-12" />
          <span className="eyebrow">·· choose your own</span>
        </div>
        <div className="eyebrow">
          step {step === "subject" ? 1 : 2} <span className="text-[#c5a059]">/</span> 2
        </div>
      </header>

      {/* step rail */}
      <div className="relative z-10 max-w-[1180px] mx-auto w-full px-10 lg:px-16 mt-8 flex items-center gap-3">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex-1 h-[2px] rounded-full"
            style={{
              background:
                (step === "subject" && i === 0) ||
                (step === "chapter" && i <= 1)
                  ? "#a35c44"
                  : "#ebe4d6",
              boxShadow:
                (step === "subject" && i === 0) ||
                (step === "chapter" && i <= 1)
                  ? "0 0 10px rgba(163,92,68,0.35)"
                  : "none",
              transition: "background-color 0.6s",
            }}
          />
        ))}
      </div>

      <main className="relative z-10 max-w-[1180px] w-full mx-auto px-10 lg:px-16 py-12 lg:py-16">
        <AnimatePresence mode="wait">
          {step === "subject" && (
            <motion.section
              key="subj"
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="eyebrow">·· i. subject</div>
              <h2
                className="mt-2 font-serif text-4xl lg:text-6xl text-[#2b211a] leading-[1.0]"
                style={{ letterSpacing: "-0.02em" }}
              >
                Which <span className="italic text-[#a35c44]">subject</span>{" "}
                today?
              </h2>
              <p className="mt-3 font-instrument-serif italic text-lg text-[#5b4f44] max-w-xl">
                {user?.syllabus_name
                  ? `Your ${user.syllabus_name} stack — pick where the work happens.`
                  : "Pick where the work happens today."}
              </p>
              <div className="rule-gold my-7 max-w-md" />

              {subjects.length === 0 ? (
                <p className="font-instrument-serif italic text-[#9b8e7e]">
                  No subjects yet. Apply a syllabus from your profile first.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {subjects.map((s) => {
                    const active = subject === s.name;
                    return (
                      <button
                        key={s.name}
                        type="button"
                        data-testid={`subject-${s.name.toLowerCase().replace(/\s/g, "-")}`}
                        onClick={() => {
                          setSubject(s.name);
                          setStep("chapter");
                        }}
                        className={`linen-card text-left p-7 transition-all ${
                          active ? "border-[#a35c44]" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="eyebrow">·· domain</span>
                          <ChevronRight size={14} className="text-[#c5a059]" />
                        </div>
                        <h3
                          className="mt-3 font-serif text-3xl text-[#2b211a]"
                          style={{ letterSpacing: "-0.015em" }}
                        >
                          {s.name}
                        </h3>
                        <div className="mt-2 font-instrument-serif italic text-sm text-[#9b8e7e]">
                          {s.count} chapters · avg mastery {s.avgMastery}%
                        </div>
                        <div className="mt-4 h-[2px] bg-[#ebe4d6] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#a35c44]"
                            style={{ width: `${s.avgMastery}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.section>
          )}

          {step === "chapter" && activeSubject && (
            <motion.section
              key="chap"
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="eyebrow flex items-center gap-3">
                <span>·· ii. chapter</span>
                <span className="rule-gold w-10" />
                <span>{activeSubject.name.toLowerCase()}</span>
              </div>
              <h2
                className="mt-2 font-serif text-4xl lg:text-6xl text-[#2b211a] leading-[1.0]"
                style={{ letterSpacing: "-0.02em" }}
              >
                Pick the{" "}
                <span className="italic text-[#a35c44]">chapter</span>.
              </h2>
              <p className="mt-3 font-instrument-serif italic text-lg text-[#5b4f44] max-w-xl">
                Ranked by what the agent would prioritise — but the choice is
                yours.
              </p>
              <div className="rule-gold my-7 max-w-md" />

              {/* duration chip */}
              <div className="flex items-center gap-3 mb-8 flex-wrap">
                <span className="eyebrow">·· duration</span>
                {[10, 15, 25, 45].map((m) => (
                  <button
                    key={m}
                    onClick={() => setDuration(m)}
                    data-testid={`duration-${m}`}
                    className={`px-4 h-9 rounded-full font-sans text-xs tracking-wide transition-all ${
                      duration === m
                        ? "bg-[#a35c44] text-white"
                        : "border border-[#e5ded0] text-[#5b4f44] hover:border-[#a35c44] hover:text-[#a35c44]"
                    }`}
                  >
                    {m} min
                  </button>
                ))}
              </div>

              <ul className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-1">
                {activeSubject.items.map((t, i) => (
                  <li
                    key={t.id}
                    onClick={() => onPick(t, duration)}
                    data-testid={`chapter-${t.id}`}
                    className="group cursor-pointer border-b border-[#e5ded0] py-4 flex items-baseline justify-between gap-3 hover:border-[#a35c44] transition-colors"
                  >
                    <div className="flex items-baseline gap-3 min-w-0">
                      <span className="font-instrument-serif italic text-[#c5a059] text-sm w-7 shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-serif text-lg text-[#2b211a] truncate group-hover:text-[#a35c44] transition-colors">
                        {t.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {!t.last_touched_at && (
                        <span className="font-sans text-[10px] tracking-[0.18em] uppercase text-[#c5a059]">
                          new
                        </span>
                      )}
                      <span className="font-instrument-serif italic text-sm text-[#a35c44] w-12 text-right">
                        {t.mastery}%
                      </span>
                      <ArrowRight
                        size={14}
                        className="text-[#9b8e7e] group-hover:text-[#a35c44] transition-colors"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 max-w-[1180px] w-full mx-auto px-10 lg:px-16 pb-10 flex items-center justify-between eyebrow">
        <span>·· studyos · choose your own path · 2026</span>
        <span>—</span>
        <span>{step === "subject" ? "step 1 of 2" : "step 2 of 2"}</span>
      </footer>
    </motion.div>
  );
}
