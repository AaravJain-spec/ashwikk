import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import "@/App.css";
import { api, getToken, clearToken } from "@/lib/api";
import AuthScreen from "@/components/AuthScreen";
import ContextMap from "@/components/ContextMap";
import ZenFrame from "@/components/ZenFrame";

export default function App() {
  const [user, setUser] = useState(null);
  const [bootChecked, setBootChecked] = useState(false);
  const [topics, setTopics] = useState([]);
  const [activeTopic, setActiveTopic] = useState(null); // when set → Zen mode

  // boot: try existing token
  useEffect(() => {
    if (!getToken()) {
      setBootChecked(true);
      return;
    }
    api
      .get("/auth/me")
      .then(({ data }) => setUser(data))
      .catch(() => clearToken())
      .finally(() => setBootChecked(true));
  }, []);

  // load topics whenever user changes
  useEffect(() => {
    if (!user) return;
    api
      .get("/topics")
      .then(({ data }) => setTopics(data))
      .catch(() => {});
  }, [user, activeTopic]); // refresh on returning from Zen

  function handleLogout() {
    clearToken();
    setUser(null);
    setTopics([]);
    setActiveTopic(null);
  }

  if (!bootChecked) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="font-mono text-xs text-zinc-700 tracking-widest">
          ·· initializing canvas
        </div>
      </div>
    );
  }

  if (!user) return <AuthScreen onAuthed={(u) => setUser(u)} />;

  return (
    <div className="App">
      <AnimatePresence mode="wait">
        {activeTopic ? (
          <ZenFrame
            key="zen"
            topic={activeTopic}
            user={user}
            onExit={() => setActiveTopic(null)}
          />
        ) : (
          <ContextMap
            key="map"
            topics={topics}
            user={user}
            onLogout={handleLogout}
            onPickTopic={(t) => setActiveTopic(t)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
