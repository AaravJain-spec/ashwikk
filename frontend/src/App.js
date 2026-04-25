import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import "@/App.css";
import { api, getToken, clearToken } from "@/lib/api";
import AuthScreen from "@/components/AuthScreen";
import BentoDashboard from "@/components/BentoDashboard";
import FlowFrame from "@/components/FlowFrame";
import Onboarding from "@/components/Onboarding";
import SocraticSidekick from "@/components/SocraticSidekick";
import useContextEngine from "@/hooks/useContextEngine";

export default function App() {
  const [user, setUser] = useState(null);
  const [bootChecked, setBootChecked] = useState(false);
  const [topics, setTopics] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeTopic, setActiveTopic] = useState(null);
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

  // load topics + sessions whenever user changes (and after a session)
  useEffect(() => {
    if (!user || !user.onboarded) return;
    Promise.all([api.get("/topics"), api.get("/sessions")])
      .then(([t, s]) => {
        setTopics(t.data);
        setSessions(s.data);
      })
      .catch(() => {});
  }, [user, activeTopic]);

  // poll for active session on flow entry
  useEffect(() => {
    if (!activeTopic) {
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
  }, [activeTopic]);

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
    setShowOnboarding(false);
  }

  function handleAuthed(u) {
    setUser(u);
    if (!u.onboarded) setShowOnboarding(true);
  }

  function handleOnboardingDone(u) {
    setUser(u);
    setShowOnboarding(false);
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
        {activeTopic ? (
          <FlowFrame
            key="flow"
            topic={activeTopic}
            ctx={ctx}
            onExit={() => {
              setActiveTopic(null);
              setSidekickOpen(false);
            }}
            onOpenSidekick={() => {
              setSidekickOpen(true);
              setAutoHint(false);
            }}
          />
        ) : (
          <BentoDashboard
            key="dashboard"
            user={user}
            topics={topics}
            sessions={sessions}
            cognitiveLoad={ctx.cognitiveLoad}
            isStruggling={ctx.isStruggling}
            onPickTopic={(t) => setActiveTopic(t)}
            onLogout={handleLogout}
            onOpenSidekick={() => {
              setSidekickOpen(true);
              setAutoHint(false);
            }}
            onChangeSyllabus={() => setShowOnboarding(true)}
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
