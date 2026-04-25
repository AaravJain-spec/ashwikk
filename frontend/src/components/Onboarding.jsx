import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Library,
  Upload,
} from "lucide-react";
import { api } from "@/lib/api";

/**
 * Onboarding — 3-step ribbon:
 *   1. Country
 *   2. Class / Grade
 *   3. Syllabus source: National (default) or Upload custom
 */
export default function Onboarding({ user, onDone }) {
  const [step, setStep] = useState(0);
  const [options, setOptions] = useState([]); // [{country, name, flag, classes:[]}]
  const [country, setCountry] = useState(user?.country || "");
  const [classLevel, setClassLevel] = useState(user?.class_level || "");
  const [preview, setPreview] = useState(null); // national preview for selected
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // upload state
  const [file, setFile] = useState(null);
  const [pasted, setPasted] = useState("");
  const [uploadName, setUploadName] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    api
      .get("/syllabus/options")
      .then(({ data }) => setOptions(data.countries || []))
      .catch(() => setErr("could not load syllabus options"));
  }, []);

  const countryEntry = useMemo(
    () => options.find((c) => c.country === country),
    [options, country]
  );

  // fetch national preview when country+class set and we hit step 2
  useEffect(() => {
    if (step !== 2 || !country || !classLevel) {
      setPreview(null);
      return;
    }
    api
      .get("/syllabus/national", {
        params: { country, class_level: classLevel },
      })
      .then(({ data }) => setPreview(data))
      .catch(() => setPreview(null));
  }, [step, country, classLevel]);

  async function go(direction) {
    setErr("");
    if (direction === "back") {
      setStep((s) => Math.max(0, s - 1));
      return;
    }
    if (step === 0 && !country) return setErr("please pick a country");
    if (step === 1 && !classLevel) return setErr("please pick a class");
    if (step < 2) {
      // persist profile so it survives reload
      try {
        await api.put("/profile", { country, class_level: classLevel });
      } catch {
        // ignore — non-blocking
      }
      setStep((s) => s + 1);
    }
  }

  async function applyNational() {
    setBusy(true);
    setErr("");
    try {
      const { data } = await api.post("/syllabus/apply-national", {
        country,
        class_level: classLevel,
      });
      onDone(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || "could not apply syllabus");
    } finally {
      setBusy(false);
    }
  }

  async function applyUpload() {
    if (!file && !pasted.trim()) {
      setErr("attach a file or paste your syllabus text");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      if (pasted.trim()) fd.append("text", pasted.trim());
      if (country) fd.append("country", country);
      if (classLevel) fd.append("class_level", classLevel);
      if (uploadName.trim()) fd.append("syllabus_name", uploadName.trim());
      else if (file) fd.append("syllabus_name", file.name);
      const { data } = await api.post("/syllabus/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onDone(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || "could not parse syllabus");
    } finally {
      setBusy(false);
    }
  }

  async function skipForNow() {
    setBusy(true);
    setErr("");
    try {
      const { data } = await api.post("/syllabus/skip");
      onDone(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || "could not skip");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="relative w-full min-h-screen paper text-[#2b211a] flex flex-col"
      data-testid="onboarding"
    >
      {/* masthead */}
      <header className="relative z-10 max-w-[1100px] mx-auto w-full px-10 lg:px-16 pt-10 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="font-serif italic text-2xl text-[#a35c44]">
            studyos
          </span>
          <span className="rule-gold w-16" />
          <span className="eyebrow">·· orientation</span>
        </div>
        <div className="eyebrow">
          step {step + 1} <span className="text-[#c5a059]">/</span> 3
        </div>
      </header>

      {/* step rail */}
      <div className="relative z-10 max-w-[1100px] mx-auto w-full px-10 lg:px-16 mt-8 flex items-center gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex-1 h-[2px] rounded-full"
            style={{
              background: i <= step ? "#a35c44" : "#ebe4d6",
              boxShadow: i <= step ? "0 0 10px rgba(163,92,68,0.35)" : "none",
              transition: "background-color 0.6s",
            }}
          />
        ))}
      </div>

      <main className="relative z-10 max-w-[1100px] mx-auto w-full px-10 lg:px-16 py-12 lg:py-16 flex-1">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <Step
              key="country"
              eyebrow="·· i. where"
              heading={
                <>
                  Where in the <span className="italic text-[#a35c44]">world</span>{" "}
                  are you studying?
                </>
              }
              caption="We'll line your room up with your country's curriculum."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                {options.map((c) => {
                  const active = country === c.country;
                  return (
                    <button
                      key={c.country}
                      type="button"
                      data-testid={`country-${c.country.toLowerCase().replace(/\s/g, "-")}`}
                      onClick={() => setCountry(c.country)}
                      className={`linen-card p-6 text-left transition-all ${
                        active
                          ? "border-[#a35c44] ring-1 ring-[#a35c44]/30"
                          : ""
                      }`}
                      style={
                        active
                          ? {
                              boxShadow:
                                "inset 0 0 0 1px rgba(163,92,68,0.4), 0 14px 30px -22px rgba(43,33,26,0.25)",
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="text-3xl">{c.flag}</span>
                        {active && (
                          <Check size={16} className="text-[#a35c44]" />
                        )}
                      </div>
                      <div className="font-serif text-2xl mt-3 text-[#2b211a]">
                        {c.country}
                      </div>
                      <div className="font-instrument-serif italic text-sm text-[#9b8e7e] mt-1">
                        {c.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Step>
          )}

          {step === 1 && (
            <Step
              key="class"
              eyebrow="·· ii. which year"
              heading={
                <>
                  And what's your{" "}
                  <span className="italic text-[#a35c44]">class</span>?
                </>
              }
              caption={`We'll fetch the ${countryEntry?.name || "national"} chapters meant for you.`}
            >
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-4 max-w-2xl">
                {(countryEntry?.classes || []).map((cl) => {
                  const active = classLevel === cl;
                  return (
                    <button
                      key={cl}
                      type="button"
                      data-testid={`class-${cl}`}
                      onClick={() => setClassLevel(cl)}
                      className={`h-24 linen-card flex flex-col items-center justify-center transition-all ${
                        active
                          ? "border-[#a35c44]"
                          : ""
                      }`}
                      style={
                        active
                          ? {
                              boxShadow:
                                "inset 0 0 0 1px rgba(163,92,68,0.4), 0 14px 30px -22px rgba(43,33,26,0.25)",
                            }
                          : undefined
                      }
                    >
                      <span className="font-instrument-serif italic text-[10px] tracking-[0.2em] uppercase text-[#9b8e7e]">
                        class
                      </span>
                      <span className="font-serif text-3xl text-[#2b211a]">
                        {cl}
                      </span>
                    </button>
                  );
                })}
              </div>
              {countryEntry?.classes?.length === 0 && (
                <p className="mt-6 text-[#9b8e7e] font-instrument-serif italic">
                  No classes mapped for this country yet — please pick another
                  or upload your syllabus on the next step.
                </p>
              )}
            </Step>
          )}

          {step === 2 && (
            <Step
              key="syllabus"
              eyebrow="·· iii. your syllabus"
              heading={
                <>
                  Two paths, both{" "}
                  <span className="italic text-[#a35c44]">yours</span>.
                </>
              }
              caption="Use your country's national syllabus, or upload your own. You can change this any time."
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                {/* National option */}
                <div className="linen-card p-8 flex flex-col" data-testid="national-option">
                  <div className="flex items-center gap-3">
                    <Library size={18} className="text-[#a35c44]" />
                    <span className="eyebrow">·· national curriculum</span>
                  </div>
                  <h3 className="font-serif text-2xl mt-3 text-[#2b211a]">
                    {countryEntry?.flag} {preview?.name || countryEntry?.name || "—"}
                  </h3>
                  <p className="font-instrument-serif italic text-[#5b4f44] mt-1">
                    Class {classLevel}{country ? ` · ${country}` : ""}
                  </p>
                  <div className="rule-gold my-5" />
                  {preview ? (
                    <div className="flex-1">
                      <div className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#9b8e7e]">
                        {Object.keys(preview.subjects).length} subjects ·{" "}
                        {preview.total_topics} chapters
                      </div>
                      <ul className="mt-3 space-y-2">
                        {Object.entries(preview.subjects).map(([s, t]) => (
                          <li
                            key={s}
                            className="flex items-baseline justify-between gap-3"
                          >
                            <span className="font-serif text-base text-[#2b211a]">
                              {s}
                            </span>
                            <span className="font-instrument-serif italic text-sm text-[#9b8e7e]">
                              {t.length} chapters
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="font-instrument-serif italic text-[#9b8e7e] flex-1">
                      Loading the chapters meant for you…
                    </p>
                  )}
                  <button
                    onClick={applyNational}
                    disabled={busy || !preview}
                    data-testid="apply-national-btn"
                    className="wax-seal mt-7 h-14 rounded-full text-base disabled:opacity-50"
                  >
                    {busy ? "applying…" : "Use this curriculum"}
                  </button>
                </div>

                {/* Upload option */}
                <div className="linen-card p-8 flex flex-col" data-testid="upload-option">
                  <div className="flex items-center gap-3">
                    <Upload size={18} className="text-[#c5a059]" />
                    <span className="eyebrow">·· your own document</span>
                  </div>
                  <h3 className="font-serif text-2xl mt-3 text-[#2b211a]">
                    Upload <span className="italic text-[#a35c44]">your</span>{" "}
                    syllabus
                  </h3>
                  <p className="font-instrument-serif italic text-[#5b4f44] mt-1">
                    PDF or text — Claude will read it and lay out the chapters.
                  </p>
                  <div className="rule-gold my-5" />

                  <label
                    htmlFor="syl-file"
                    data-testid="dropzone"
                    className="border border-dashed border-[#e5ded0] rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#a35c44] hover:bg-[#fff5f0]/50 transition-colors"
                  >
                    <FileText size={20} className="text-[#a35c44]" />
                    <div className="mt-2 font-serif text-base text-[#2b211a]">
                      {file ? file.name : "Drop a PDF · or click to browse"}
                    </div>
                    <div className="mt-1 font-instrument-serif italic text-xs text-[#9b8e7e]">
                      .pdf or .txt up to ~60 pages
                    </div>
                    <input
                      ref={fileRef}
                      id="syl-file"
                      type="file"
                      accept=".pdf,.txt,application/pdf,text/plain"
                      data-testid="syllabus-file-input"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>

                  <details className="mt-4">
                    <summary className="font-sans text-xs text-[#9b8e7e] tracking-wide cursor-pointer hover:text-[#a35c44]">
                      — or paste it instead
                    </summary>
                    <textarea
                      value={pasted}
                      onChange={(e) => setPasted(e.target.value)}
                      data-testid="syllabus-paste"
                      rows={5}
                      placeholder="Paste your syllabus chapter list here…"
                      className="mt-2 w-full bg-[#fffaf2] border border-[#e5ded0] rounded-2xl p-3 font-instrument-serif text-sm text-[#2b211a] focus:border-[#a35c44] transition-colors resize-none"
                    />
                  </details>

                  <input
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    data-testid="syllabus-name-input"
                    placeholder="give it a name (optional)"
                    className="mt-3 w-full bg-transparent border-b border-[#e5ded0] py-2 font-instrument-serif italic text-sm focus:border-[#a35c44] transition-colors"
                  />

                  <button
                    onClick={applyUpload}
                    disabled={busy || (!file && !pasted.trim())}
                    data-testid="apply-upload-btn"
                    className="mt-auto h-14 px-6 rounded-full border border-[#a35c44] text-[#a35c44] hover:bg-[#a35c44] hover:text-white font-serif text-base transition-all disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#a35c44]"
                  >
                    {busy ? "parsing…" : "Parse & use my syllabus"}
                  </button>
                </div>
              </div>

              <button
                onClick={skipForNow}
                data-testid="skip-onboarding-btn"
                className="mt-6 mx-auto block font-sans text-xs text-[#9b8e7e] hover:text-[#a35c44] tracking-wider transition-colors"
              >
                — i'll set this up later · use sample topics —
              </button>
            </Step>
          )}
        </AnimatePresence>

        {err && (
          <p
            data-testid="onboarding-error"
            className="mt-6 font-sans text-[12px] text-[#a35c44] italic"
          >
            ! {err}
          </p>
        )}
      </main>

      {/* footer nav */}
      {step < 2 && (
        <footer className="relative z-10 max-w-[1100px] mx-auto w-full px-10 lg:px-16 pb-10 flex items-center justify-between">
          <button
            onClick={() => go("back")}
            disabled={step === 0}
            data-testid="onb-back-btn"
            className="flex items-center gap-2 font-sans text-sm text-[#5b4f44] hover:text-[#a35c44] disabled:opacity-30 transition-colors"
          >
            <ArrowLeft size={14} /> back
          </button>
          <button
            onClick={() => go("next")}
            data-testid="onb-next-btn"
            className="wax-seal h-12 px-6 rounded-full text-sm flex items-center gap-2"
          >
            continue <ArrowRight size={14} />
          </button>
        </footer>
      )}
    </div>
  );
}

function Step({ eyebrow, heading, caption, children }) {
  return (
    <motion.section
      initial={{ y: 14, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -14, opacity: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="eyebrow">{eyebrow}</div>
      <h2
        className="font-serif text-4xl lg:text-6xl mt-2 text-[#2b211a] leading-[1.0]"
        style={{ letterSpacing: "-0.02em" }}
      >
        {heading}
      </h2>
      {caption && (
        <p className="mt-3 font-instrument-serif italic text-lg text-[#5b4f44] max-w-xl">
          {caption}
        </p>
      )}
      <div className="rule-gold my-7 max-w-md" />
      {children}
    </motion.section>
  );
}
