import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";

export default function SocraticSidekick({ session, struggle, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    api
      .get(`/chat/history?session_id=${session.id}`)
      .then(({ data }) => setMessages(data))
      .catch(() => {});
  }, [session.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  async function send(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setErr("");
    setInput("");
    // optimistic
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
      const { data } = await api.post("/chat/socratic", {
        session_id: session.id,
        text,
        struggle_score: struggle,
      });
      setMessages((m) => [...m.filter((x) => !x.id.startsWith("tmp-")), 
        { id: `u-${data.id}`, role: "user", text, created_at: data.created_at },
        data,
      ]);
    } catch (e) {
      setErr(e?.response?.data?.detail || "sidekick is silent — try again");
      // restore input
      setInput(text);
      setMessages((m) => m.filter((x) => !x.id.startsWith("tmp-")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ x: 480, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 480, opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 right-0 bottom-0 z-40 w-full max-w-md glass border-l border-white/5 flex flex-col"
      data-testid="sidekick-panel"
    >
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
        <div>
          <div className="eyebrow">·· socratic sidekick</div>
          <div className="font-display text-lg mt-1">claude · sonnet 4.5</div>
        </div>
        <button
          onClick={onClose}
          data-testid="close-sidekick-btn"
          className="font-mono text-[11px] tracking-wider text-zinc-500 hover:text-[#ff9500]"
        >
          // close
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-6 space-y-4"
      >
        {messages.length === 0 && (
          <div className="text-zinc-600 font-mono text-xs leading-relaxed">
            ·· i don't lecture. ask me what to try, what i'd notice, or where
            you're stuck. i'll give you one nudge at a time.
          </div>
        )}
        {messages.map((m) => (
          <Message key={m.id} m={m} />
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-zinc-600 font-mono text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" />
            thinking..
          </div>
        )}
        {err && (
          <div className="font-mono text-[11px] text-[#ff9500]">! {err}</div>
        )}
      </div>

      <form
        onSubmit={send}
        className="p-4 border-t border-white/5"
        data-testid="sidekick-form"
      >
        <div className="flex items-end gap-2 bg-[#0a0a0a] border border-[#27272a] rounded-2xl p-3 focus-within:border-[#00f0ff] transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="ask for one nudge.."
            data-testid="sidekick-input"
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm text-zinc-200 placeholder-zinc-700 max-h-32"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            data-testid="sidekick-send-btn"
            className="h-9 px-4 rounded-full bg-[#00f0ff] text-black text-xs font-medium tracking-tight disabled:opacity-40"
            style={{ boxShadow: "0 0 24px -6px rgba(0,240,255,0.6)" }}
          >
            send
          </button>
        </div>
        <div className="mt-2 font-mono text-[10px] text-zinc-700 tracking-wider">
          ·· enter to send · shift+enter newline · context: struggle {struggle}
        </div>
      </form>
    </motion.div>
  );
}

function Message({ m }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[#00f0ff]/8 border border-[#00f0ff]/20 px-4 py-2 text-sm text-zinc-100">
          {m.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex">
      <div className="max-w-[88%] text-sm text-zinc-300 leading-relaxed">
        <span className="font-mono text-[10px] text-zinc-600 tracking-wider mr-2">
          ··
        </span>
        {m.text}
      </div>
    </div>
  );
}
