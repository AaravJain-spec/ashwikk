import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Shuffle,
} from "lucide-react";
import { rankTopics } from "@/lib/priorityEngine";

/**
 * Subject → Chapter picker with three modes:
 *
 *   1. "subject"  — original 2-step flow: pick a subject, then a chapter.
 *   2. "browse"   — single scrollable view with a sticky subject sidebar.
 *                   Click any subject in the rail to smooth-scroll to its
 *                   section. Pick a chapter to start a single session.
 *   3. "mix"      — same scrollable layout but with checkboxes; select
 *                   chapters across subjects (e.g. English + Mathematics)
 *                   and start a queued, mixed-practice run.
 */
export default function SubjectChapterPicker({
  topics,
  user,
  onCancel,
  onPick,
}) {
  const [mode, setMode] = useState("subject"); // "subject" | "browse" | "mix"
  const [step, setStep] = useState("subject"); // only for subject mode
  const [subject, setSubject] = useState(null);
  const [duration, setDuration] = useState(25);
  const [selected, setSelected] = useState(() => new Set()); // mix-mode topic ids
  const [activeAnchor, setActiveAnchor] = useState(null);

  const scrollRef = useRef(null);
  const sectionRefs = useRef({});

  // group topics by domain (subject)
  const subjects = useMemo(() => {
    const map = new Map();
    for (const t of topics) {
      const key = t.domain || "Untitled";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    const arr = [];
    for (const [name, items] of map.entries()) {
      const ranked = rankTopics(items);
      const avgMastery = Math.round(
        items.reduce((s, t) => s + (t.mastery || 0), 0) /
          Math.max(1, items.length)
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

  const slug = (s) =>
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  // Track which subject section is currently in view (scroll-spy).
  useEffect(() => {
    if (mode === "subject") return undefined;
    const root = scrollRef.current;
    if (!root) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          setActiveAnchor(visible[0].target.getAttribute("data-anchor"));
        }
      },
      { root, rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.25, 0.6] }
    );
    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [mode, subjects]);

  function jumpTo(name) {
    const el = sectionRefs.current[slug(name)];
    if (el && scrollRef.current) {
      // smooth-scroll the inner container, not the page
      const top = el.offsetTop - 12;
      scrollRef.current.scrollTo({ top, behavior: "smooth" });
      setActiveAnchor(slug(name));
    }
  }

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllInSubject(s, checked) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const t of s.items) {
        if (checked) next.add(t.id);
        else next.delete(t.id);
      }
      return next;
    });
  }

  function startMix() {
    const list = topics.filter((t) => selected.has(t.id));
    if (list.length === 0) return;
    onPick(list, duration);
  }

  // header back-button behaves differently per mode
  function handleBack() {
    if (mode === "subject" && step === "chapter") {
      setStep("subject");
      return;
    }
    onCancel();
  }

  return (
    <motion.div
      key="picker"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="relative w-full h-screen overflow-y-auto paper text-[#2b211a] flex flex-col"
      data-testid="picker-screen"
    >
      <header className="relative z-10 max-w-[1280px] w-full mx-auto px-10 lg:px-16 pt-10 flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={handleBack}
          data-testid="picker-back-btn"
          className="flex items-center gap-2 text-sm text-[#5b4f44] hover:text-[#a35c44] font-sans transition-colors"
        >
          <ArrowLeft size={14} />{" "}
          {mode === "subject" && step === "chapter" ? "subjects" : "back"}
        </button>
        <div className="flex items-baseline gap-3">
          <span className="font-serif italic text-2xl text-[#a35c44]">
            studyos
          </span>
          <span className="rule-gold w-12" />
          <span className="eyebrow">·· choose your own</span>
        </div>
        <ModeTabs mode={mode} setMode={setMode} setStep={setStep} />
      </header>

      {/* step rail (only for subject mode) */}
      {mode === "subject" && (
        <div className="relative z-10 max-w-[1280px] mx-auto w-full px-10 lg:px-16 mt-8 flex items-center gap-3">
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
      )}

      <main className="relative z-10 max-w-[1280px] w-full mx-auto px-10 lg:px-16 py-12 lg:py-14 flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {/* ─── MODE: SUBJECT (existing 2-step flow) ─── */}
          {mode === "subject" && step === "subject" && (
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
                        data-testid={`subject-${slug(s.name)}`}
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
                          <ChevronRight
                            size={14}
                            className="text-[#c5a059]"
                          />
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

          {mode === "subject" && step === "chapter" && activeSubject && (
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

              <DurationPicker duration={duration} setDuration={setDuration} />

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

          {/* ─── MODE: BROWSE / MIX (scroll-rail layout) ─── */}
          {(mode === "browse" || mode === "mix") && (
            <motion.section
              key={mode}
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <div className="flex items-end justify-between gap-6 flex-wrap">
                <div>
                  <div className="eyebrow flex items-center gap-2">
                    <span>
                      ·· {mode === "browse" ? "browse all" : "mix mode"}
                    </span>
                    {mode === "mix" && (
                      <span className="px-2 py-0.5 rounded-full bg-[#fff5f0] border border-[#a35c44]/30 text-[#a35c44]">
                        select multiple
                      </span>
                    )}
                  </div>
                  <h2
                    className="mt-2 font-serif text-4xl lg:text-5xl text-[#2b211a] leading-[1.0]"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {mode === "browse" ? (
                      <>
                        Scroll the{" "}
                        <span className="italic text-[#a35c44]">
                          whole syllabus
                        </span>
                        .
                      </>
                    ) : (
                      <>
                        Build a{" "}
                        <span className="italic text-[#a35c44]">
                          mixture
                        </span>{" "}
                        of chapters.
                      </>
                    )}
                  </h2>
                  <p className="mt-2 font-instrument-serif italic text-base text-[#5b4f44] max-w-xl">
                    {mode === "browse"
                      ? "Jump between subjects with the rail on the left — every chapter is one click away."
                      : "Pick chapters across English, Mathematics, anything. The agent will rotate through them as one mixed run."}
                  </p>
                </div>
                <DurationPicker
                  duration={duration}
                  setDuration={setDuration}
                  compact
                />
              </div>

              <div className="rule-gold my-6" />

              {subjects.length === 0 ? (
                <p className="font-instrument-serif italic text-[#9b8e7e]">
                  No subjects yet. Apply a syllabus from your profile first.
                </p>
              ) : (
                <div className="flex-1 grid grid-cols-12 gap-8 min-h-0">
                  {/* Sticky subject rail */}
                  <aside className="col-span-12 md:col-span-3 lg:col-span-3">
                    <div
                      className="md:sticky md:top-6 max-h-[70vh] overflow-y-auto pr-2"
                      data-testid="subject-rail"
                    >
                      <div className="eyebrow mb-3">·· subjects</div>
                      <ul className="space-y-1">
                        {subjects.map((s) => {
                          const isActive = activeAnchor === slug(s.name);
                          const selectedCount =
                            mode === "mix"
                              ? s.items.filter((t) =>
                                  selected.has(t.id)
                                ).length
                              : 0;
                          return (
                            <li key={s.name}>
                              <button
                                type="button"
                                onClick={() => jumpTo(s.name)}
                                data-testid={`rail-${slug(s.name)}`}
                                className={`group w-full text-left px-3 py-2 rounded-xl flex items-center justify-between gap-2 transition-colors ${
                                  isActive
                                    ? "bg-[#fff5f0] text-[#a35c44]"
                                    : "text-[#5b4f44] hover:bg-[#fffaf2] hover:text-[#a35c44]"
                                }`}
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="w-1 h-4 rounded-full shrink-0"
                                    style={{
                                      background: isActive
                                        ? "#a35c44"
                                        : "#ebe4d6",
                                    }}
                                  />
                                  <span className="font-serif text-base truncate">
                                    {s.name}
                                  </span>
                                </span>
                                {mode === "mix" && selectedCount > 0 ? (
                                  <span className="font-sans text-[10px] tracking-wider px-2 py-0.5 rounded-full bg-[#a35c44] text-white">
                                    {selectedCount}
                                  </span>
                                ) : (
                                  <span className="font-instrument-serif italic text-xs text-[#9b8e7e]">
                                    {s.count}
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </aside>

                  {/* Scrollable section list */}
                  <div
                    ref={scrollRef}
                    className="col-span-12 md:col-span-9 lg:col-span-9 max-h-[70vh] overflow-y-auto pr-2 pb-32 scroll-smooth"
                    data-testid="chapter-scroll"
                  >
                    {subjects.map((s) => {
                      const allSelected =
                        mode === "mix" &&
                        s.items.length > 0 &&
                        s.items.every((t) => selected.has(t.id));
                      return (
                        <section
                          key={s.name}
                          ref={(el) => {
                            sectionRefs.current[slug(s.name)] = el;
                          }}
                          data-anchor={slug(s.name)}
                          className="mb-10"
                          data-testid={`section-${slug(s.name)}`}
                        >
                          <div className="flex items-baseline justify-between gap-3 sticky top-0 bg-[#fdfbf7]/95 backdrop-blur-sm py-2 z-[1]">
                            <div className="flex items-baseline gap-3 min-w-0">
                              <h3
                                className="font-serif text-2xl text-[#2b211a]"
                                style={{ letterSpacing: "-0.015em" }}
                              >
                                {s.name}
                              </h3>
                              <span className="font-instrument-serif italic text-sm text-[#9b8e7e]">
                                · {s.count} chapters · {s.avgMastery}% mastery
                              </span>
                            </div>
                            {mode === "mix" && (
                              <button
                                type="button"
                                onClick={() =>
                                  selectAllInSubject(s, !allSelected)
                                }
                                data-testid={`select-all-${slug(s.name)}`}
                                className="font-sans text-[10px] tracking-[0.18em] uppercase text-[#9b8e7e] hover:text-[#a35c44] transition-colors"
                              >
                                {allSelected ? "clear" : "select all"}
                              </button>
                            )}
                          </div>
                          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1 mt-2">
                            {s.items.map((t, i) => {
                              const isChecked = selected.has(t.id);
                              const Row = (
                                <div className="flex items-baseline gap-3 min-w-0 flex-1">
                                  <span className="font-instrument-serif italic text-[#c5a059] text-sm w-7 shrink-0">
                                    {String(i + 1).padStart(2, "0")}
                                  </span>
                                  <span className="font-serif text-base text-[#2b211a] truncate">
                                    {t.name}
                                  </span>
                                </div>
                              );
                              const Meta = (
                                <div className="flex items-center gap-3 shrink-0">
                                  {!t.last_touched_at && (
                                    <span className="font-sans text-[10px] tracking-[0.18em] uppercase text-[#c5a059]">
                                      new
                                    </span>
                                  )}
                                  <span className="font-instrument-serif italic text-sm text-[#a35c44] w-10 text-right">
                                    {t.mastery}%
                                  </span>
                                </div>
                              );

                              if (mode === "mix") {
                                return (
                                  <li key={t.id}>
                                    <label
                                      className={`group flex items-center gap-3 cursor-pointer border-b border-[#e5ded0] py-3 transition-colors ${
                                        isChecked
                                          ? "border-[#a35c44]"
                                          : "hover:border-[#a35c44]"
                                      }`}
                                      data-testid={`mix-row-${t.id}`}
                                    >
                                      <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={isChecked}
                                        onChange={() => toggleSelected(t.id)}
                                      />
                                      <span
                                        className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                                          isChecked
                                            ? "bg-[#a35c44] border-[#a35c44]"
                                            : "border-[#e5ded0] group-hover:border-[#a35c44]"
                                        }`}
                                      >
                                        {isChecked && (
                                          <Check
                                            size={12}
                                            className="text-white"
                                          />
                                        )}
                                      </span>
                                      {Row}
                                      {Meta}
                                    </label>
                                  </li>
                                );
                              }

                              return (
                                <li
                                  key={t.id}
                                  onClick={() => onPick(t, duration)}
                                  data-testid={`chapter-${t.id}`}
                                  className="group cursor-pointer border-b border-[#e5ded0] py-3 flex items-baseline justify-between gap-3 hover:border-[#a35c44] transition-colors"
                                >
                                  {Row}
                                  <div className="flex items-center gap-3 shrink-0">
                                    {!t.last_touched_at && (
                                      <span className="font-sans text-[10px] tracking-[0.18em] uppercase text-[#c5a059]">
                                        new
                                      </span>
                                    )}
                                    <span className="font-instrument-serif italic text-sm text-[#a35c44] w-10 text-right">
                                      {t.mastery}%
                                    </span>
                                    <ArrowRight
                                      size={14}
                                      className="text-[#9b8e7e] group-hover:text-[#a35c44] transition-colors"
                                    />
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </section>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* sticky start-mix bar */}
      <AnimatePresence>
        {mode === "mix" && selected.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 max-w-[760px] w-[92%]"
            data-testid="mix-start-bar"
          >
            <div className="linen-card p-4 flex items-center gap-4 flex-wrap">
              <Shuffle size={16} className="text-[#a35c44]" />
              <div className="flex-1 min-w-0">
                <div className="font-serif text-base text-[#2b211a]">
                  {selected.size}{" "}
                  <span className="italic text-[#a35c44]">
                    chapter{selected.size === 1 ? "" : "s"}
                  </span>{" "}
                  in your mix
                </div>
                <div className="font-instrument-serif italic text-xs text-[#9b8e7e]">
                  the agent will queue them and rotate through one mini-session
                  at a time
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                data-testid="mix-clear-btn"
                className="h-10 px-3 rounded-full font-sans text-xs text-[#9b8e7e] hover:text-[#a35c44] tracking-wider transition-colors"
              >
                clear
              </button>
              <button
                type="button"
                onClick={startMix}
                data-testid="mix-start-btn"
                className="wax-seal h-11 px-6 rounded-full text-sm flex items-center gap-2"
              >
                Start mix <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="relative z-10 max-w-[1280px] w-full mx-auto px-10 lg:px-16 pb-10 flex items-center justify-between eyebrow">
        <span>·· studyos · choose your own path · 2026</span>
        <span>—</span>
        <span>
          {mode === "subject"
            ? step === "subject"
              ? "step 1 of 2"
              : "step 2 of 2"
            : mode === "browse"
            ? "browse mode"
            : `mix · ${selected.size} selected`}
        </span>
      </footer>
    </motion.div>
  );
}

function ModeTabs({ mode, setMode, setStep }) {
  const tabs = [
    { id: "subject", label: "by subject" },
    { id: "browse", label: "browse all" },
    { id: "mix", label: "mix mode" },
  ];
  return (
    <div
      className="flex items-center gap-1 p-1 rounded-full border border-[#e5ded0] bg-[#fffaf2]"
      data-testid="picker-mode-tabs"
    >
      {tabs.map((t) => {
        const active = mode === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setMode(t.id);
              if (t.id === "subject") setStep("subject");
            }}
            data-testid={`mode-${t.id}`}
            className={`px-4 h-8 rounded-full font-sans text-xs tracking-wide transition-colors ${
              active
                ? "bg-[#a35c44] text-white"
                : "text-[#5b4f44] hover:text-[#a35c44]"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function DurationPicker({ duration, setDuration, compact = false }) {
  return (
    <div
      className={`flex items-center gap-2 flex-wrap ${
        compact ? "" : "mb-8"
      }`}
    >
      <span className="eyebrow">·· duration</span>
      {[10, 15, 25, 45].map((m) => (
        <button
          key={m}
          onClick={() => setDuration(m)}
          data-testid={`duration-${m}`}
          className={`px-3 h-8 rounded-full font-sans text-xs tracking-wide transition-all ${
            duration === m
              ? "bg-[#a35c44] text-white"
              : "border border-[#e5ded0] text-[#5b4f44] hover:border-[#a35c44] hover:text-[#a35c44]"
          }`}
        >
          {m} min
        </button>
      ))}
    </div>
  );
}
