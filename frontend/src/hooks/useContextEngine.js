import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * useContextEngine
 * --------------------------------------------------
 * Tracks behavioral signals and synthesizes a CognitiveLoad ∈ [0, 1].
 *
 *   - idleTime          : seconds since last meaningful input
 *   - inputVelocity     : chars-per-second over the recent ~6s window
 *   - videoReplayCount  : caller-incremented counter (proxy for re-watching)
 *
 * CognitiveLoad blending:
 *   - rising idle (>20s without input) → +load
 *   - very high *or* very low input velocity → +load (frantic typing OR frozen)
 *   - each video replay adds a small persistent bump
 *   - load decays slowly toward 0 over time
 *
 * isStruggling = CognitiveLoad > 0.8
 *
 * Side-effect: when isStruggling toggles, body.classList toggles `struggling`,
 * which triggers the global cream → warm-cream background morph in index.css.
 */
export default function useContextEngine() {
  const [idleTime, setIdleTime] = useState(0);
  const [inputVelocity, setInputVelocity] = useState(0);
  const [videoReplayCount, setVideoReplayCount] = useState(0);
  const [cognitiveLoad, setCognitiveLoad] = useState(0);

  const lastInputAt = useRef(Date.now());
  const charBuffer = useRef([]); // [{t, n}]
  const replayBumpRef = useRef(0);
  const manualUntilRef = useRef(0); // ms epoch — auto-tick paused until this

  // 1) wire global listeners
  useEffect(() => {
    function onActivity(deltaChars = 0) {
      const now = Date.now();
      lastInputAt.current = now;
      if (deltaChars > 0) {
        charBuffer.current.push({ t: now, n: deltaChars });
        // keep last 6s
        const cutoff = now - 6000;
        charBuffer.current = charBuffer.current.filter((e) => e.t > cutoff);
      }
    }
    const onKey = (e) => {
      const ignore = ["Shift", "Control", "Alt", "Meta", "Tab", "Escape"];
      if (ignore.includes(e.key)) {
        onActivity(0);
        return;
      }
      onActivity(1);
    };
    const onMouse = () => onActivity(0);
    const onScroll = () => onActivity(0);

    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", onMouse);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  // 2) tick every 500ms — recompute signals + cognitive load
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const idle = (now - lastInputAt.current) / 1000;
      setIdleTime(idle);

      // chars/sec over last 6s
      const cutoff = now - 6000;
      charBuffer.current = charBuffer.current.filter((e) => e.t > cutoff);
      const totalChars = charBuffer.current.reduce((s, e) => s + e.n, 0);
      const cps = totalChars / 6;
      setInputVelocity(cps);

      // honor manual override window
      if (now < manualUntilRef.current) return;

      // ---- blend signals into [0,1] ----
      // idle: 0..30s ⇒ 0..0.6 contribution (saturating)
      const idleLoad = Math.min(0.6, idle / 30 * 0.6);

      // velocity: sweet spot ~ 1.5–4 cps (calm, productive typing).
      // outside that, contribute load. zero typing for >5s while idle is high
      // already covered by idleLoad; this catches frantic spikes.
      let velLoad = 0;
      if (cps > 6) velLoad = Math.min(0.35, (cps - 6) / 8 * 0.35); // frantic
      else if (cps > 0 && cps < 0.5) velLoad = 0.15; // crawling typing

      // replay bump (persistent, decays slow)
      replayBumpRef.current = Math.max(
        0,
        replayBumpRef.current - 0.005 // decay per tick
      );
      const replayLoad = Math.min(0.4, replayBumpRef.current);

      const next = Math.min(1, idleLoad + velLoad + replayLoad);

      // Smooth: ease toward target (organic, not jumpy)
      setCognitiveLoad((prev) => prev + (next - prev) * 0.18);
    }, 500);
    return () => clearInterval(id);
  }, []);

  // 3) struggling toggle + body class
  const isStruggling = cognitiveLoad > 0.8;
  useEffect(() => {
    if (isStruggling) document.body.classList.add("struggling");
    else document.body.classList.remove("struggling");
    return () => document.body.classList.remove("struggling");
  }, [isStruggling]);

  const recordReplay = useCallback(() => {
    replayBumpRef.current = Math.min(0.5, replayBumpRef.current + 0.18);
    setVideoReplayCount((n) => n + 1);
  }, []);

  // dev/test helper to forcibly bump load (used by the slider in FlowFrame)
  const setLoadOverride = useCallback((value) => {
    const v = Math.max(0, Math.min(1, value));
    manualUntilRef.current = Date.now() + 6000; // keep for 6s
    setCognitiveLoad(v);
  }, []);

  return useMemo(
    () => ({
      idleTime,
      inputVelocity,
      videoReplayCount,
      cognitiveLoad,
      isStruggling,
      recordReplay,
      setLoadOverride,
    }),
    [
      idleTime,
      inputVelocity,
      videoReplayCount,
      cognitiveLoad,
      isStruggling,
      recordReplay,
      setLoadOverride,
    ]
  );
}
