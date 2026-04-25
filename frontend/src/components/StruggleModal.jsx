import { motion } from "framer-motion";
import { AlertTriangle, ChevronDown } from "lucide-react";

/**
 * Struggle Interrupt Modal — a calm but unmistakable interruption when the
 * agent detects the student is stuck. Two clear paths only.
 */
export default function StruggleModal({
  open,
  reason,
  onEasier,
  onMiniQuiz,
  onDismiss,
}) {
  if (!open) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      data-testid="struggle-modal"
    >
      {/* warm scrim */}
      <div className="absolute inset-0 bg-[#fff5f0]/85 backdrop-blur-md" />

      <motion.div
        initial={{ y: 18, opacity: 0, scale: 0.985 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 18, opacity: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-xl linen-card p-10 lg:p-12 breathe-warm"
        style={{ background: "#fffaf2" }}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle size={18} className="text-[#a35c44]" />
          <span className="eyebrow text-[#a35c44]">·· you're stuck</span>
        </div>
        <h2
          className="mt-5 font-serif text-4xl lg:text-5xl text-[#2b211a] leading-[1.0]"
          style={{ letterSpacing: "-0.02em" }}
        >
          The agent is{" "}
          <span className="italic text-[#a35c44]">interrupting</span>.
        </h2>
        <p className="mt-4 font-instrument-serif italic text-lg text-[#5b4f44]">
          {reason || "Repeated mistakes — let's change tack before this becomes a hole."}
        </p>

        <div className="rule-gold my-7" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={onEasier}
            data-testid="easier-btn"
            className="wax-seal h-14 rounded-full text-base"
          >
            Try an easier version
          </button>
          <button
            onClick={onMiniQuiz}
            data-testid="mini-quiz-btn"
            className="h-14 px-6 rounded-full border border-[#a35c44] text-[#a35c44] hover:bg-[#a35c44] hover:text-white font-serif text-base transition-all"
          >
            Solve 2 quick questions
          </button>
        </div>

        <button
          onClick={onDismiss}
          data-testid="dismiss-struggle-btn"
          className="mt-6 mx-auto flex items-center gap-1 text-xs text-[#9b8e7e] hover:text-[#a35c44] font-sans tracking-wider transition-colors"
        >
          <ChevronDown size={12} /> push through anyway
        </button>
      </motion.div>
    </motion.div>
  );
}
