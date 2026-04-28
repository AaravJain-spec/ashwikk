import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  ImagePlus,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import StruggleModal from "@/components/StruggleModal";

/**
 * Active Session — the Execution Engine UI.
 *   - Generates Q's via Claude Sonnet 4.5
 *   - Accepts answer, evaluates, returns instant feedback + next Q
 *   - Live HUD: timer, progress bar (target reps), AI insight line
 *   - Auto-loads next question
 *   - Triggers StruggleModal on streak_wrong>=3 or high cognitive load
 */
const TARGET_REPS = 5;

export default function ActiveSession({
  topic,
  durationMinutes,
  ctx,
  onExit,
  onOpenSidekick,
  mixInfo = null,
}) {
  const [session, setSession] = useState(null);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null); // {correct, score, feedback}
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [counts, setCounts] = useState({
    answered: 0,
    correct: 0,
    streakCorrect: 0,
    streakWrong: 0,
  });
  const [insight, setInsight] = useState("·· initializing the engine");
  const [interrupt, setInterrupt] = useState({ open: false, reason: "" });
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const [running, setRunning] = useState(true);
  const [done, setDone] = useState(false);

  // attached picture-of-answer (data URL) — local-only companion to the typed answer
  const [answerImage, setAnswerImage] = useState(null);
  const [imageError, setImageError] = useState("");
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const tickRef = useRef(null);
  const qStartRef = useRef(Date.now());

  // 1) start session + load first question
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const { data: s } = await api.post("/sessions/start", {
          topic_id: topic.id,
          duration_minutes: durationMinutes,
        });
        if (cancelled) return;
        setSession(s);
        const { data: q } = await api.post(`/sessions/${s.id}/question`, {});
        if (cancelled) return;
        setQuestion(q);
        qStartRef.current = Date.now();
        setInsight("·· first rep — commit to one line.");
      } catch (e) {
        setInsight("·· could not reach the engine — try exit and back.");
      } finally {
        setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic.id, durationMinutes]);

  // 2) timer
  useEffect(() => {
    if (!running || done) return undefined;
    tickRef.current = setInterval(
      () => setSecondsLeft((s) => Math.max(0, s - 1)),
      1000
    );
    return () => clearInterval(tickRef.current);
  }, [running, done]);

  // when timer hits 0, finish
  useEffect(() => {
    if (secondsLeft === 0 && !done) finishSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  // 3) push struggle score to backend (debounced)
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

  // 4) high-load interrupt (independent of streak)
  useEffect(() => {
    if (
      ctx.isStruggling &&
      !interrupt.open &&
      counts.answered > 0 &&
      !feedback
    ) {
      setInterrupt({
        open: true,
        reason: "Cognitive load is climbing — let's switch the angle.",
      });
    }
  }, [ctx.isStruggling]); // eslint-disable-line react-hooks/exhaustive-deps

  function fmt(s) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  function handlePickImage(e) {
    setImageError("");
    const file = e?.target?.files?.[0];
    // reset the input so picking the same file twice fires onChange
    if (e?.target) e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("that file isn't an image");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setImageError("image is over 6MB — try a smaller one");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAnswerImage(reader.result);
    reader.onerror = () => setImageError("could not read that image");
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setAnswerImage(null);
    setImageError("");
  }

  async function loadNext({ easier = false } = {}) {
    if (!session) return;
    setBusy(true);
    setFeedback(null);
    setAnswer("");
    setAnswerImage(null);
    setImageError("");
    try {
      const { data: q } = await api.post(`/sessions/${session.id}/question`, {
        easier,
      });
      setQuestion(q);
      qStartRef.current = Date.now();
    } catch (e) {
      setInsight("·· the agent stumbled fetching the next question.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer(e) {
    e?.preventDefault();
    if (!session || !question || submitting || feedback) return;
    // require either text or an attached image
    const hasText = answer.trim().length > 0;
    if (!hasText && !answerImage) return;
    setSubmitting(true);
    try {
      const elapsed_ms = Date.now() - qStartRef.current;
      // append a marker for the AI grader so it knows a picture was attached
      const submittedAnswer = hasText
        ? answerImage
          ? `${answer.trim()}\n\n[student also attached a picture of their handwritten work]`
          : answer.trim()
        : "[student submitted only a picture of their handwritten work]";
      const { data } = await api.post(`/sessions/${session.id}/answer`, {
        question_id: question.id,
        answer: submittedAnswer,
        elapsed_ms,
      });
      setFeedback({
        correct: data.correct,
        score: data.score,
        feedback: data.feedback,
      });
      setCounts({
        answered: data.total_answered,
        correct: Math.round(data.accuracy * data.total_answered),
        streakCorrect: data.streak_correct,
        streakWrong: data.streak_wrong,
      });
      setInsight(`·· ${data.insight}`);

      if (data.should_interrupt) {
        setInterrupt({ open: true, reason: data.interrupt_reason });
      }

      // session complete?
      if (data.total_answered >= TARGET_REPS) {
        // brief pause, then auto-finish
        setTimeout(() => finishSession(), 1200);
      }
    } catch (e) {
      setInsight("·· evaluation hiccuped — try submitting again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function finishSession() {
    if (done) return;
    setDone(true);
    try {
      if (session) {
        const acc = counts.answered ? counts.correct / counts.answered : 0;
        const delta = Math.round(acc * counts.answered * 1.2);
        await api.post(`/sessions/${session.id}/end`, {
          mastery_delta: Math.max(-2, Math.min(20, delta)),
        });
      }
    } catch {
      // ignore
    }
    onExit();
  }

  async function exitNow() {
    if (done) return;
    setDone(true);
    try {
      if (session) {
        await api.post(`/sessions/${session.id}/end`, { mastery_delta: -1 });
      }
    } catch {
      // noop
    }
    onExit();
  }

  // struggle modal handlers
  async function handleEasier() {
    if (session) {
      api
        .post(`/sessions/${session.id}/event`, { type: "easier_requested" })
        .catch(() => {});
    }
    setInterrupt({ open: false, reason: "" });
    await loadNext({ easier: true });
    setInsight("·· dropped to easy — one clean rep.");
  }
  async function handleMiniQuiz() {
    if (session) {
      api
        .post(`/sessions/${session.id}/event`, { type: "mini_quiz_taken" })
        .catch(() => {});
    }
    setInterrupt({ open: false, reason: "" });
    await loadNext({ easier: true });
    setInsight("·· two quick reps — easier than the last.");
  }
  function handleDismiss() {
    if (session) {
      api
        .post(`/sessions/${session.id}/event`, { type: "interrupt_dismissed" })
        .catch(() => {});
    }
    setInterrupt({ open: false, reason: "" });
  }

  const total = durationMinutes * 60;
  const timeProgress = total ? 1 - secondsLeft / total : 0;
  const repProgress = Math.min(1, counts.answered / TARGET_REPS);

  return (
    <motion.div
      key="active"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.55 }}
      className="relative w-full min-h-screen overflow-hidden paper text-[#2b211a]"
      data-testid="active-session"
    >
      {/* HUD top */}
      <div className="absolute top-0 left-0 right-0 z-20 px-10 lg:px-16 py-7 flex items-center justify-between">
        <button
          onClick={exitNow}
          data-testid="exit-active-btn"
          className="flex items-center gap-2 text-sm text-[#5b4f44] hover:text-[#a35c44] font-sans transition-colors"
        >
          <ArrowLeft size={14} /> end
        </button>
        <div className="flex items-center gap-3 eyebrow">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: ctx.isStruggling ? "#a35c44" : "#c5a059",
              boxShadow: `0 0 14px ${ctx.isStruggling ? "#a35c44" : "#c5a059"}`,
            }}
          />
          <span data-testid="ai-insight">{insight}</span>
        </div>
        <button
          onClick={onOpenSidekick}
          data-testid="open-sidekick-btn-active"
          className="text-sm text-[#5b4f44] hover:text-[#a35c44] font-sans transition-colors"
        >
          sidekick
        </button>
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-6 py-24">
        <motion.div
          layout
          layoutId="task-card"
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className={`sheet w-full max-w-3xl p-10 md:p-14 ${
            ctx.isStruggling ? "breathe-warm" : "breathe-sienna"
          }`}
          data-testid="active-sheet"
        >
          {/* topic */}
          <div className="flex items-center justify-between">
            <div className="eyebrow flex items-center gap-2">
              <span>·· session · {topic.domain.toLowerCase()}</span>
              {mixInfo && (
                <span
                  className="ml-1 px-2 py-0.5 rounded-full bg-[#fff5f0] border border-[#a35c44]/30 text-[#a35c44]"
                  data-testid="mix-badge"
                >
                  mix · {mixInfo.index + 1}/{mixInfo.total}
                </span>
              )}
            </div>
            <div className="font-instrument-serif italic text-[#c5a059] text-sm">
              {question?.difficulty
                ? `· difficulty · ${question.difficulty}`
                : "· loading"}
            </div>
          </div>
          <h1
            className="mt-3 font-serif text-3xl md:text-4xl text-[#2b211a]"
            style={{ letterSpacing: "-0.015em" }}
            data-testid="active-topic-title"
          >
            <span className="italic">{topic.name.toLowerCase()}</span>
            <span className="text-[#a35c44]">.</span>
          </h1>

          {/* HUD: timer + reps + load */}
          <div className="mt-7 grid grid-cols-3 gap-6">
            <Stat label="time" value={fmt(secondsLeft)} progress={timeProgress} struggling={ctx.isStruggling} testid="active-timer" />
            <Stat
              label="reps"
              value={`${counts.answered} / ${TARGET_REPS}`}
              progress={repProgress}
              struggling={ctx.isStruggling}
              testid="active-reps"
            />
            <Stat
              label="streak"
              value={
                counts.streakCorrect > 0
                  ? `+${counts.streakCorrect}`
                  : counts.streakWrong > 0
                  ? `-${counts.streakWrong}`
                  : "—"
              }
              accentColor={
                counts.streakWrong > 0 ? "#a35c44" : "#c5a059"
              }
              progress={
                counts.streakCorrect > 0
                  ? Math.min(1, counts.streakCorrect / 5)
                  : Math.min(1, counts.streakWrong / 3)
              }
              struggling={ctx.isStruggling}
              testid="active-streak"
            />
          </div>

          <div className="rule-gold my-7" />

          {/* Question */}
          {question ? (
            <div>
              <div className="eyebrow mb-2">·· question</div>
              <p
                className="font-instrument-serif text-xl text-[#2b211a] leading-relaxed"
                data-testid="question-prompt"
              >
                {question.prompt}
              </p>
            </div>
          ) : (
            <div className="font-instrument-serif italic text-[#9b8e7e]">
              {busy ? "the engine is generating your first question…" : ""}
            </div>
          )}

          {/* Answer */}
          {question && !feedback && (
            <form onSubmit={submitAnswer} className="mt-7" data-testid="answer-form">
              <div className="eyebrow mb-2">·· your answer</div>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    submitAnswer();
                  }
                }}
                placeholder="write your way through it… (cmd/ctrl + enter to submit)"
                data-testid="answer-input"
                rows={4}
                disabled={submitting}
                className="w-full bg-transparent border-b border-[#e5ded0] focus:border-[#a35c44] resize-none font-instrument-serif text-base text-[#2b211a] placeholder-[#c8bdab] py-2 leading-relaxed transition-colors disabled:opacity-50"
              />

              {/* hidden inputs — file picker + camera capture */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePickImage}
                className="hidden"
                data-testid="answer-image-input"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePickImage}
                className="hidden"
                data-testid="answer-camera-input"
              />

              {/* Attached-image preview */}
              <AnimatePresence>
                {answerImage && (
                  <motion.div
                    key="img-preview"
                    initial={{ y: 6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -4, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-4 flex items-start gap-4 p-3 rounded-2xl border border-[#e5ded0] bg-[#fffaf2]"
                    data-testid="answer-image-preview"
                  >
                    <img
                      src={answerImage}
                      alt="your handwritten answer"
                      className="h-24 w-24 object-cover rounded-xl border border-[#e5ded0]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="eyebrow text-[#a35c44]">·· picture attached</div>
                      <p className="mt-1 font-instrument-serif italic text-sm text-[#5b4f44] leading-relaxed">
                        a snapshot of your work will travel with this answer.
                        you can still write a short note above to help the
                        grader.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={clearImage}
                      data-testid="remove-image-btn"
                      className="text-[#9b8e7e] hover:text-[#a35c44] transition-colors p-1"
                      title="remove picture"
                    >
                      <X size={16} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {imageError && (
                <div
                  className="mt-2 font-sans text-[11px] tracking-wide text-[#a35c44] italic"
                  data-testid="image-error"
                >
                  ! {imageError}
                </div>
              )}

              <div className="mt-5 flex items-center gap-3 flex-wrap">
                <button
                  type="submit"
                  disabled={
                    submitting || (!answer.trim() && !answerImage)
                  }
                  data-testid="submit-answer-btn"
                  className="wax-seal h-12 px-7 rounded-full text-base disabled:opacity-50"
                >
                  {submitting ? "evaluating…" : "Submit"}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting}
                  data-testid="attach-image-btn"
                  className="h-12 px-4 rounded-full border border-[#e5ded0] text-[#5b4f44] hover:border-[#a35c44] hover:text-[#a35c44] font-sans text-sm transition-colors flex items-center gap-2"
                  title="attach a picture of your handwritten work"
                >
                  <ImagePlus size={14} />
                  {answerImage ? "replace photo" : "attach photo"}
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={submitting}
                  data-testid="capture-image-btn"
                  className="h-12 w-12 rounded-full border border-[#e5ded0] text-[#5b4f44] hover:border-[#a35c44] hover:text-[#a35c44] transition-colors flex items-center justify-center"
                  title="take a photo with your camera"
                >
                  <Camera size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => loadNext({ easier: false })}
                  disabled={busy || submitting}
                  data-testid="skip-question-btn"
                  className="h-12 px-5 rounded-full border border-[#e5ded0] text-[#5b4f44] hover:border-[#a35c44] hover:text-[#a35c44] font-sans text-sm transition-colors flex items-center gap-2 ml-auto"
                >
                  skip <ChevronRight size={14} />
                </button>
              </div>
            </form>
          )}

          {/* Feedback + auto-next */}
          <AnimatePresence>
            {feedback && (
              <motion.div
                key="fb"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.4 }}
                data-testid="feedback-card"
                className={`mt-7 p-5 rounded-2xl border ${
                  feedback.correct
                    ? "bg-[#fffaf2] border-[#c5a059]/40"
                    : "bg-[#fff5f0] border-[#a35c44]/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {feedback.correct ? (
                      <>
                        <Check size={16} className="text-[#c5a059]" />
                        <span className="eyebrow text-[#c5a059]">·· correct</span>
                      </>
                    ) : (
                      <>
                        <X size={16} className="text-[#a35c44]" />
                        <span className="eyebrow text-[#a35c44]">·· not quite</span>
                      </>
                    )}
                  </div>
                  <span className="font-instrument-serif italic text-sm text-[#9b8e7e]">
                    score {feedback.score}
                  </span>
                </div>
                <p className="mt-2 font-instrument-serif italic text-base text-[#2b211a] leading-relaxed">
                  {feedback.feedback}
                </p>
                {answerImage && (
                  <div
                    className="mt-4 flex items-center gap-3"
                    data-testid="feedback-image"
                  >
                    <img
                      src={answerImage}
                      alt="your handwritten answer"
                      className="h-20 w-20 object-cover rounded-xl border border-[#e5ded0]"
                    />
                    <span className="font-instrument-serif italic text-xs text-[#9b8e7e]">
                      your attached picture for this rep
                    </span>
                  </div>
                )}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => loadNext()}
                    disabled={busy}
                    data-testid="next-question-btn"
                    className="wax-seal h-11 px-5 rounded-full text-sm disabled:opacity-50"
                  >
                    {counts.answered >= TARGET_REPS ? "wrap up" : "next question"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* mini stats */}
          <div className="mt-8 flex items-center justify-between font-sans text-[10px] tracking-[0.2em] uppercase text-[#9b8e7e]">
            <span>idle {Math.round(ctx.idleTime ?? 0)}s</span>
            <span>v {(ctx.inputVelocity ?? 0).toFixed(1)} cps</span>
            <span>load {Math.round((ctx.cognitiveLoad ?? 0) * 100)}%</span>
          </div>
        </motion.div>
      </div>

      <StruggleModal
        open={interrupt.open}
        reason={interrupt.reason}
        onEasier={handleEasier}
        onMiniQuiz={handleMiniQuiz}
        onDismiss={handleDismiss}
      />
    </motion.div>
  );
}

function Stat({ label, value, progress = 0, struggling, accentColor, testid }) {
  const c = accentColor || (struggling ? "#a35c44" : "#c5a059");
  return (
    <div data-testid={testid}>
      <div className="eyebrow">{label}</div>
      <div
        className="font-serif text-3xl md:text-4xl mt-1 tracking-tight"
        style={{ color: struggling ? "#a35c44" : "#2b211a" }}
      >
        {value}
      </div>
      <div className="mt-2 h-[2px] bg-[#ebe4d6] rounded-full overflow-hidden">
        <motion.div
          className="h-full"
          style={{ background: c }}
          animate={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </div>
  );
}
