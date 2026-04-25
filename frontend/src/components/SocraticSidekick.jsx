import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";

/**
 * Socratic Sidekick — editorial side-margin column.
 * Two roles:
 *  1. When `autoOpen` (struggle detected), a small "Socratic Hint" card slides
 *     in even before the user clicks anything.
 *  2. Manual chat panel for interaction with Claude Sonnet 4.5.
 */
export default function SocraticSidekick({
  session,
  ctx,
  onClose,
  autoHint = false,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!session) return;
    api
      .get(`/chat/history?session_id=${session.id}`)
      .then(({ data }) => setMessages(data))
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  async function send(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy || !session) return;
    setBusy(true);
    setErr("");
    setInput("");
    setMessages((m) => [
      ...m,
      {
        id: `tmp-${Date.now()}`,
        role: "user",
        text,
        created_at: new Date().toISOString(),
      },
    ]);
    try {
      const score = Math.round((ctx?.cognitiveLoad ?? 0) * 100);
      const { data } = await api.post("/chat/socratic", {
        session_id: session.id,
        text,
        struggle_score: score,
      });
      setMessages((m) => [
        ...m.filter((x) => !x.id.startsWith("tmp-")),
        {
          id: `u-${data.id}`,
          role: "user",
          text,
          created_at: data.created_at,
        },
        data,
      ]);
    } catch (e) {
      setErr(e?.response?.data?.detail || "the sidekick is silent — try again");
      setInput(text);
      setMessages((m) => m.filter((x) => !x.id.startsWith("tmp-")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.aside
      initial={{ x: 480, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 480, opacity: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 right-0 bottom-0 z-40 w-full max-w-md flex flex-col linen-card rounded-none rounded-l-[28px] border-r-0"
      style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
      data-testid="sidekick-panel"
    >
      <div className="flex items-baseline justify-between px-7 py-6 border-b border-[#e5ded0]">
        <div>
          <div className="eyebrow">·· socratic sidekick</div>
          <div className="font-serif italic text-xl text-[#2b211a] mt-1">
            Claude · sonnet 4.5
          </div>
        </div>
        <button
          onClick={onClose}
          data-testid="close-sidekick-btn"
          className="text-xs text-[#9b8e7e] hover:text-[#a35c44] font-sans tracking-wider transition-colors"
        >
          close
        </button>
      </div>

      {/* Auto Socratic Hint banner */}
      <AnimatePresence>
        {autoHint && (
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="mx-7 mt-5 p-5 rounded-2xl bg-[#fff5f0] border border-[#e5ded0]"
            data-testid="socratic-hint-card"
          >
            <div className="eyebrow mb-2">·· socratic hint</div>
            <p className="font-instrument-serif italic text-[#2b211a] leading-relaxed">
              The room is breathing. Try one of these — a smaller example, a
              simpler restatement, or a single line you can defend.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-7 py-6 space-y-5"
      >
        {messages.length === 0 && (
          <div className="font-instrument-serif italic text-[#9b8e7e] leading-relaxed">
            "Ask me what to try, what I'd notice, or where you're stuck. I will
            give one nudge at a time, never a lecture."
          </div>
        )}
        {messages.map((m) => (
          <Message key={m.id} m={m} />
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-[#9b8e7e] font-sans text-xs italic">
            <span className="w-1.5 h-1.5 rounded-full bg-[#a35c44] animate-pulse" />
            thinking..
          </div>
        )}
        {err && (
          <div className="font-sans text-[12px] text-[#a35c44] italic">
            ! {err}
          </div>
        )}
      </div>

      <form
        onSubmit={send}
        className="p-5 border-t border-[#e5ded0]"
        data-testid="sidekick-form"
      >
        <div className="flex items-end gap-2 bg-[#fffaf2] border border-[#e5ded0] rounded-2xl p-3 focus-within:border-[#a35c44] transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="ask for one nudge…"
            data-testid="sidekick-input"
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm text-[#2b211a] placeholder-[#c8bdab] max-h-32 font-instrument-serif italic"
          />
          <button
            type="submit"
            disabled={busy || !input.trim() || !session}
            data-testid="sidekick-send-btn"
            className="wax-seal h-10 px-5 rounded-full text-xs disabled:opacity-40"
          >
            Send
          </button>
        </div>
        <div className="mt-2 font-sans text-[10px] tracking-[0.16em] uppercase text-[#9b8e7e]">
          {session ? "in-session" : "no session — start one to converse"} ·
          load {Math.round((ctx?.cognitiveLoad ?? 0) * 100)}%
        </div>
      </form>
    </motion.aside>
  );
}

function Message({ m }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#fff5f0] border border-[#e5ded0] px-4 py-2 text-[15px] text-[#2b211a] font-instrument-serif italic">
          {m.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex">
      <div className="max-w-[88%] text-[15px] text-[#2b211a] leading-relaxed font-instrument-serif">
        <span className="font-serif italic text-[#c5a059] mr-2">—</span>
        {m.text}
      </div>
    </div>
  );
}
