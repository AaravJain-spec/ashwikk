import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import "@/App.css";
import { api, getToken, clearToken } from "@/lib/api";
import ActiveSession from "@/components/ActiveSession";
import AuthScreen from "@/components/AuthScreen";
import HeroScreen from "@/components/HeroScreen";
import InsightsScreen from "@/components/InsightsScreen";
import Onboarding from "@/components/Onboarding";
import SocraticSidekick from "@/components/SocraticSidekick";
import useContextEngine from "@/hooks/useContextEngine";

export default function App() {
  const [user, setUser] = useState(null);
  const [bootChecked, setBootChecked] = useState(false);
  const [topics, setTopics] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [view, setView] = useState("hero"); // "hero" | "active" | "insights"
  const [activeTopic, setActiveTopic] = useState(null);
  const [activeDuration, setActiveDuration] = useState(25);
  const [activeSession, setActiveSession] = useState(null);
  const [sidekickOpen, setSidekickOpen] = useState(false);
  const [autoHint, setAutoHint] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const ctx = useContextEngine();
  const struggleEdgeRef = useRef(false);

  // boot
  useEffect(() => {
    if (!getToken()) {
      setBootChecked(true);
      return;
    }
    api
      .get("/auth/me")
      .then(({ data }) => {
        setUser(data);
        if (!data.onboarded) setShowOnboarding(true);
      })
      .catch(() => clearToken())
      .finally(() => setBootChecked(true));
  }, []);

  // topics + sessions whenever user changes (and after a session ends)
  useEffect(() => {
    if (!user || !user.onboarded) return;
    Promise.all([api.get("/topics"), api.get("/sessions")])
      .then(([t, s]) => {
        setTopics(t.data);
        setSessions(s.data);
      })
      .catch(() => {});
  }, [user, view]); // re-fetch on view change (after session end)

  // poll for the live session id once we enter active view
  useEffect(() => {
    if (view !== "active" || !activeTopic) {
      setActiveSession(null);
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const { data } = await api.get("/sessions");
        const live = data.find(
          (s) => s.topic_id === activeTopic.id && !s.ended_at
        );
        if (live && !cancelled) {
          setActiveSession(live);
          return;
        }
      } catch {
        // ignore
      }
      if (!cancelled && attempts < 8) setTimeout(tick, 500);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [view, activeTopic]);

  useEffect(() => {
    if (ctx.isStruggling && !struggleEdgeRef.current) {
      struggleEdgeRef.current = true;
      setSidekickOpen(true);
      setAutoHint(true);
    } else if (!ctx.isStruggling && struggleEdgeRef.current) {
      struggleEdgeRef.current = false;
      setAutoHint(false);
    }
  }, [ctx.isStruggling]);

  function handleLogout() {
    clearToken();
    setUser(null);
    setTopics([]);
    setSessions([]);
    setActiveTopic(null);
    setSidekickOpen(false);
    setView("hero");
    setShowOnboarding(false);
  }

  function handleAuthed(u) {
    setUser(u);
    if (!u.onboarded) setShowOnboarding(true);
  }

  function handleOnboardingDone(u) {
    setUser(u);
    setShowOnboarding(false);
    setView("hero");
  }

  function handleStartSession(topic, minutes = 25) {
    setActiveTopic(topic);
    setActiveDuration(minutes);
    setView("active");
  }

  function handleExitActive() {
    setActiveTopic(null);
    setActiveSession(null);
    setSidekickOpen(false);
    setView("hero");
  }

  if (!bootChecked) {
    return (
      <div className="w-full h-screen paper flex items-center justify-center">
        <div className="font-instrument-serif italic text-[#9b8e7e]">
          opening the room…
        </div>
      </div>
    );
  }

  if (!user) return <AuthScreen onAuthed={handleAuthed} />;

  if (showOnboarding) {
    return <Onboarding user={user} onDone={handleOnboardingDone} />;
  }

  return (
    <div className="App">
      <AnimatePresence mode="wait">
        {view === "active" && activeTopic && (
          <ActiveSession
            key="active"
            topic={activeTopic}
            durationMinutes={activeDuration}
            ctx={ctx}
            onExit={handleExitActive}
            onOpenSidekick={() => {
              setSidekickOpen(true);
              setAutoHint(false);
            }}
          />
        )}
        {view === "insights" && (
          <InsightsScreen key="insights" onBack={() => setView("hero")} />
        )}
        {view === "hero" && (
          <HeroScreen
            key="hero"
            user={user}
            topics={topics}
            sessions={sessions}
            cognitiveLoad={ctx.cognitiveLoad}
            isStruggling={ctx.isStruggling}
            onStart={handleStartSession}
            onLogout={handleLogout}
            onChangeSyllabus={() => setShowOnboarding(true)}
            onOpenInsights={() => setView("insights")}
            onOpenSidekick={() => {
              setSidekickOpen(true);
              setAutoHint(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sidekickOpen && (
          <SocraticSidekick
            session={activeSession}
            ctx={ctx}
            autoHint={autoHint}
            onClose={() => {
              setSidekickOpen(false);
              setAutoHint(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
